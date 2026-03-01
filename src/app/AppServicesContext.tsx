import { createContext, useContext, type PropsWithChildren } from 'react'
import type { AppServices } from '../domain/services'

const AppServicesContext = createContext<AppServices | null>(null)

interface AppServicesProviderProps extends PropsWithChildren {
  services: AppServices
}

export function AppServicesProvider({ services, children }: AppServicesProviderProps) {
  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>
}

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext)

  if (!services) {
    throw new Error('useAppServices must be used within AppServicesProvider')
  }

  return services
}
