import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const Home = () => (
  <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
    <Image
      src="/logo/milestone-logo-black.png"
      alt=""
      width={178}
      height={100}
      priority
    />
    <h1 className="font-heading text-3xl font-semibold">Milestone</h1>
    <p className="text-muted-foreground">
      Tasks, habits and focus sessions in one dashboard.
    </p>
    <Button asChild>
      <Link href="/dashboard">Open dashboard</Link>
    </Button>
  </main>
)

export default Home
