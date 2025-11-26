import { PageLoader } from "@/components/ui/page-loader"

export default function AdminLoading() {
  return (
    <PageLoader
      message="Loading admin workspace..."
      hint="Preparing navigation and dashboard data"
    />
  )
}
