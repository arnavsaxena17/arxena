import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const response = await fetch('https://greatmove.webflow.io', {
    headers: {
      'Content-Security-Policy': 'frame-ancestors *'
    }
  })
  
  const data = await response.text()
  
  return new NextResponse(data, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Security-Policy': 'frame-ancestors *'
    }
  })
}
