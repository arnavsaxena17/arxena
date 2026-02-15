import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Body = {
  name?: string;
  email?: string;
  company?: string;
  requestedCompany?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const requestedCompany =
      typeof body.requestedCompany === 'string'
        ? body.requestedCompany.trim()
        : '';

    if (!email) {
      return NextResponse.json(
        { message: 'Email is required.' },
        { status: 400 },
      );
    }
    if (!requestedCompany) {
      return NextResponse.json(
        { message: 'Which company org chart do you want to see? is required.' },
        { status: 400 },
      );
    }

    const company =
      typeof body.company === 'string' ? body.company.trim() : undefined;

    // Log lead for now; persistence (DB / email) can be added later
    console.info('Org chart request lead', {
      name: name || undefined,
      email,
      company,
      requestedCompany,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: 'Invalid request body.' },
      { status: 400 },
    );
  }
}
