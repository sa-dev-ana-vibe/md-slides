interface ErrorBannerProps {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700" role="alert">
      {message}
    </div>
  )
}
