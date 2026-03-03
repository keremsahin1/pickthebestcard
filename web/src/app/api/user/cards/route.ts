import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import sql from '@/db/schema';

export async function GET() {
  const session = await getAuth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const cards = await sql`
    SELECT c.* FROM cards c
    JOIN user_cards uc ON uc.card_id = c.id
    WHERE uc.user_id = ${session.user.id}
    ORDER BY c.issuer, c.name
  `;
  return NextResponse.json(cards);
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await req.json();
  await sql`INSERT INTO user_cards (user_id, card_id) VALUES (${session.user.id}, ${cardId}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { cardId } = await req.json();
  await sql`DELETE FROM user_cards WHERE user_id = ${session.user.id} AND card_id = ${cardId}`;
  return NextResponse.json({ ok: true });
}
