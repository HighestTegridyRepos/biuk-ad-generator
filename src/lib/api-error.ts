import { NextResponse } from "next/server"

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    )
  }
  console.error("Unhandled error:", error)
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "An unexpected error occurred" },
    { status: 500 }
  )
}
