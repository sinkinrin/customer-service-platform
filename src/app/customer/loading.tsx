import { PageLoader } from "@/components/ui/page-loader"

export default function CustomerLoading() {
  return (
    <PageLoader
      message="Loading customer pages..."
      hint="Preparing your shortcuts and data"
    />
  )
}
