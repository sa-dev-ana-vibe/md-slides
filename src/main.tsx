import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'
import { AppServicesProvider } from './app/AppServicesContext'
import { createAppServices } from './app/createAppServices'

registerSW({ immediate: true })

const services = createAppServices()

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <AppServicesProvider services={services}>
      <App />
    </AppServicesProvider>
  </StrictMode>
)
