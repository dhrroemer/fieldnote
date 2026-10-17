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
  const plotId = typeof body?.plotId === 'string' ? body.plotId : '';
  const crop = typeof body?.crop === 'string' ? body.crop.trim() : '';
  const variety = typeof body?.variety === 'string' ? body.variety.trim() : '';
  const plantedOn = typeof body?.plantedOn === 'string' ? body.plantedOn : '';
  const expectedHarvest =
    typeof body?.expectedHarvest === 'string' ? body.expectedHarvest : '';

  if (
    !plotId ||
    !crop ||
    !variety ||
    !isValidDateString(plantedOn) ||
    !isValidDateString(expectedHarvest) ||
    expectedHarvest < plantedOn
  ) {
    return NextResponse.json(
      {
        error:
          'Enter a crop, variety, valid dates, and a harvest date after planting.',
      },
      { status: 400 },
    );
  }

  const data = await readFarmData();
  const plot = data.plots.find((item) => item.id === plotId);
  if (!plot) {
    return NextResponse.json(
      { error: 'Choose an existing plot.' },
      { status: 404 },
    );
  }
  if (
    data.plantings.some(
      (planting) =>
        planting.plotId === plotId && planting.status !== 'harvested',
    )
  ) {
    return NextResponse.json(
      { error: 'This plot already has a growing crop.' },
      { status: 409 },
    );
  }

  const planting = {
    id: createId('plant'),
    plotId,
    crop,
    variety,
    plantedOn,
    expectedHarvest,
    status: 'growing' as const,
  };
  plot.state = 'active';
  data.plantings.push(planting);
  await writeFarmData(data);
  return NextResponse.json(planting, { status: 201 });
}

export async function PATCH(request: Request) {
  const denied = requireOwner(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const plotId = typeof body?.plotId === 'string' ? body.plotId : '';
  const crop = typeof body?.crop === 'string' ? body.crop.trim() : '';
  const variety = typeof body?.variety === 'string' ? body.variety.trim() : '';
  const plantedOn = typeof body?.plantedOn === 'string' ? body.plantedOn : '';
  const expectedHarvest =
    typeof body?.expectedHarvest === 'string' ? body.expectedHarvest : '';

  if (
    !id ||
    !plotId ||
    !crop ||
    !variety ||
    !isValidDateString(plantedOn) ||
    !isValidDateString(expectedHarvest) ||
    expectedHarvest < plantedOn
  ) {
    return NextResponse.json(
      { error: 'Enter a crop, variety, and valid dates in the correct order.' },
      { status: 400 },
    );
  }

  const data = await readFarmData();
  const planting = data.plantings.find((item) => item.id === id);
  const plot = data.plots.find((item) => item.id === plotId);
  if (!planting) {
    return NextResponse.json({ error: 'Planting not found.' }, { status: 404 });
  }
  if (!plot) {
    return NextResponse.json({ error: 'Choose an existing plot.' }, { status: 404 });
  }
  if (
    data.plantings.some(
      (item) =>
        item.id !== id &&
        item.plotId === plotId &&
        item.status !== 'harvested',
    )
  ) {
    return NextResponse.json(
      { error: 'This plot already has a growing crop.' },
      { status: 409 },
    );
  }

  const previousPlotId = planting.plotId;
  Object.assign(planting, { plotId, crop, variety, plantedOn, expectedHarvest });
  const previousPlot = data.plots.find((item) => item.id === previousPlotId);
  if (previousPlotId !== plotId && previousPlot) {
    previousPlot.state = data.plantings.some(
      (item) => item.plotId === previousPlotId && item.status !== 'harvested',
    )
      ? 'active'
      : 'resting';
  }
  plot.state = 'active';
  await writeFarmData(data);
  return NextResponse.json(planting);
}

export async function DELETE(request: Request) {
  const denied = requireOwner(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const data = await readFarmData();
  const planting = data.plantings.find((item) => item.id === id);
  if (!planting) {
    return NextResponse.json({ error: 'Planting not found.' }, { status: 404 });
  }
  if (data.harvests.some((harvest) => harvest.plantingId === id)) {
    return NextResponse.json(
      { error: 'Plantings with harvest history cannot be deleted.' },
      { status: 409 },
    );
  }
  data.plantings = data.plantings.filter((item) => item.id !== id);
  const plot = data.plots.find((item) => item.id === planting.plotId);
  if (plot) {
    plot.state = data.plantings.some(
      (item) => item.plotId === plot.id && item.status !== 'harvested',
    )
      ? 'active'
      : 'resting';
  }
  await writeFarmData(data);
  return NextResponse.json({ success: true });
}
