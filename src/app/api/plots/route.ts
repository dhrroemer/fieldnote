import { NextResponse } from 'next/server';
import { createId, readFarmData, writeFarmData } from '@/lib/farm-store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const area = Number(body?.area);
  const soil = typeof body?.soil === 'string' ? body.soil.trim() : '';

  if (!name || !Number.isFinite(area) || area <= 0 || !soil) {
    return NextResponse.json(
      { error: 'Enter a name, soil type, and positive area.' },
      { status: 400 },
    );
  }

  const data = readFarmData();
  const plot = {
    id: createId('plot'),
    name,
    area,
    soil,
    state: 'resting' as const,
  };
  data.plots.push(plot);
  writeFarmData(data);
  return NextResponse.json(plot, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const area = Number(body?.area);
  const soil = typeof body?.soil === 'string' ? body.soil.trim() : '';

  if (!id || !name || !Number.isFinite(area) || area <= 0 || !soil) {
    return NextResponse.json(
      { error: 'Enter a name, soil type, and positive area.' },
      { status: 400 },
    );
  }

  const data = readFarmData();
  const plot = data.plots.find((item) => item.id === id);
  if (!plot) {
    return NextResponse.json({ error: 'Plot not found.' }, { status: 404 });
  }
  Object.assign(plot, { name, area, soil });
  writeFarmData(data);
  return NextResponse.json(plot);
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const data = readFarmData();
  const plotIndex = data.plots.findIndex((item) => item.id === id);
  if (plotIndex < 0) {
    return NextResponse.json({ error: 'Plot not found.' }, { status: 404 });
  }
  if (data.plantings.some((planting) => planting.plotId === id)) {
    return NextResponse.json(
      { error: 'Plots with planting history cannot be deleted.' },
      { status: 409 },
    );
  }
  data.plots.splice(plotIndex, 1);
  writeFarmData(data);
  return NextResponse.json({ success: true });
}
