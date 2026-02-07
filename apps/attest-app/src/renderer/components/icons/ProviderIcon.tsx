import { type ModelProvider, ModelProviderEnum } from 'src/shared/types';

export default function ProviderIcon(props: { className?: string; size?: number; provider: ModelProvider | string }) {
  const { className, size = 24, provider } = props

  return (
    <svg
      className={className}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      {provider === ModelProviderEnum.NearAI && (
        <>
          <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45v6.9L12 17.82l-6.9-3.45v-6.9L12 4.18z" />
          <path d="M12 6.5L6 9.5v5l6 3 6-3v-5l-6-3z" fillOpacity=".7" />
        </>
      )}
    </svg>
  )
}
