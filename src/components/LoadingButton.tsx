import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

type LoadingButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  'asChild'
> & {
  loading: boolean
  loadingText: string
}

const LoadingButton = ({
  loading,
  loadingText,
  disabled,
  children,
  ...props
}: LoadingButtonProps) => {
  return (
    <Button disabled={loading || disabled} aria-busy={loading} {...props}>
      {loading && <Spinner data-icon="inline-start" aria-hidden />}
      {loading ? loadingText : children}
    </Button>
  )
}

export default LoadingButton
