const { NextResponse } = require('next/server');

function GET() {
  return NextResponse.json({
    ok: true,
    service: 'mellune-dashboard-api',
    timestamp: new Date().toISOString(),
  });
}

module.exports = { GET };
