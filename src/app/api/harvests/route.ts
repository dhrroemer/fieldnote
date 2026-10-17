import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/api-auth';
import {
  createId,
  isValidDateString,
  readFarmData,
  writeFarmData,
} from '@/lib/farm-store';

export async function POST(request: Request) {
  const denied = requireOwner(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const plantingId =
    typeof body?.plantingId === 'string' ? body.plantingId : '';
  const quantity = Number(body?.quantity);
  const unit = typeof body?.unit === 'string' ? body.unit : 'kg';
  const harvestedOn =
    typeof body?.harvestedOn === 'string' ? body.harvestedOn : '';
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';

  if (
    !plantingId ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !isValidDateString(harvestedOn) ||
    !['kg', 'bunches', 'items'].includes(unit)
  ) {
    return NextResponse.json(
      {
        error:
          'Enter a planting, positive quantity, unit, and valid harvest date.',
      },
      { status: 400 },
    );
  }

  const data = await readFarmData();
  const planting = data.plantings.find((item) => item.id === plantingId);
  if (!planting) {
    return NextResponse.json(
      { error: 'Choose an existing planting.' },
      { status: 404 },
    );
  }
  if (planting.status === 'harvested') {
    return NextResponse.json(
      { error: 'This planting has already been harvested.' },
      { status: 409 },
    );
  }

  const harvest = {
    id: createId('harvest'),
    plantingId,
    crop: planting.crop,
    quantity,
    unit,
    harvestedOn,
    notes,
  };
  data.harvests.unshift(harvest);
  planting.status = 'harvested';
  const plot = data.plots.find((item) => item.id === planting.plotId);
  if (plot) plot.state = 'resting';
  await writeFarmData(data);
  return NextResponse.json(harvest, { status: 201 });
}

export async function PATCH(request: Request) {
  const denied = requireOwner(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const quantity = Number(body?.quantity);
  const unit = typeof body?.unit === 'string' ? body.unit : 'kg';
  const harvestedOn =
    typeof body?.harvestedOn === 'string' ? body.harvestedOn : '';
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';

  if (
    !id ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !isValidDateString(harvestedOn) ||
    !['kg', 'bunches', 'items'].includes(unit)
  ) {
    return NextResponse.json(
      { error: 'Enter a positive quantity, valid unit, and valid harvest date.' },
      { status: 400 },
    );
  }

  const data = await readFarmData();
  const harvest = data.harvests.find((item) => item.id === id);
  if (!harvest) {
    return NextResponse.json({ error: 'Harvest not found.' }, { status: 404 });
  }
  Object.assign(harvest, { quantity, unit, harvestedOn, notes });
  await writeFarmData(data);
  return NextResponse.json(harvest);
}

export async function DELETE(request: Request) {
  const denied = requireOwner(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const data = await readFarmData();
  const harvestIndex = data.harvests.findIndex((item) => item.id === id);
  if (harvestIndex < 0) {
    return NextResponse.json({ error: 'Harvest not found.' }, { status: 404 });
  }
  const [harvest] = data.harvests.splice(harvestIndex, 1);
  if (!data.harvests.some((item) => item.plantingId === harvest.plantingId)) {
    const planting = data.plantings.find(
      (item) => item.id === harvest.plantingId,
    );
    if (planting) {
      planting.status = planting.expectedHarvest <= new Date().toISOString().slice(0, 10)
        ? 'ready'
        : 'growing';
      const plot = data.plots.find((item) => item.id === planting.plotId);
      if (plot) plot.state = 'active';
    }
  }
  await writeFarmData(data);
  return NextResponse.json({ success: true });
}
