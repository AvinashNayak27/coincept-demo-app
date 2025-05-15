import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
  const { username } = params;

  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') || '1';
  const limit = searchParams.get('limit') || '10';

  const targetUrl = `https://api.devfolio.co/api/users/${username}/publicProjects?page=${page}&limit=${limit}`;

  const response = await fetch(targetUrl, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  return NextResponse.json(data, {
    status: response.status,
  });
}
