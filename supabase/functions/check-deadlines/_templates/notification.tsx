/** @jsxImportSource npm:react@18.3.1 */
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "npm:@react-email/components@0.0.12";
import React from "npm:react@18.3.1";

interface NotificationEmailProps {
  title: string
  message: string
  actionUrl?: string
  actionText?: string
  userName?: string
  type?: 'info' | 'success' | 'warning' | 'error'
}

const BRAND = {
  primary: '#F28705',
  primaryLight: '#F29F05',
  primaryDark: '#D95204',
  white: '#FFFFFF',
  ink: '#1D1D1D',
  surface: '#242424',
  surfaceSoft: '#2E2E2E',
  bodyText: '#D6D6D6',
  mutedText: '#9A9A9A',
  border: '#3A3A3A',
}

const LOGO_URL = 'https://pla.soma.lefil.com.br/__l5e/assets-v1/d7297f7a-a043-4df6-be34-f64231868c28/soma-logo-white.png'

export const NotificationEmail = ({
  title,
  message,
  actionUrl,
  actionText = 'Ver detalhes',
  userName,
  type = 'info',
}: NotificationEmailProps) => {
  const getTypeColor = () => {
    switch (type) {
      case 'success':
        return BRAND.primary
      case 'warning':
        return BRAND.primaryLight
      case 'error':
        return BRAND.primaryDark
      default:
        return BRAND.primary
    }
  }

  const accentColor = getTypeColor()

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with logo */}
          <Section style={headerSection}>
            <Img
              src={LOGO_URL}
              alt="SoMA+"
              width="160"
              height="auto"
              style={logo}
            />
          </Section>

          {/* Accent bar */}
          {React.createElement("div", {
            style: { ...accentBar, backgroundColor: accentColor },
          })}

          {/* Main content */}
          <Section style={contentSection}>
            {userName && (
              <Text style={greeting}>Olá, {userName}!</Text>
            )}

            <Heading style={heading}>{title}</Heading>

            <Text style={messageText}>{message}</Text>

            {actionUrl && (
              <Section style={buttonSection}>
                <Button style={{ ...button, backgroundColor: accentColor }} href={actionUrl}>
                  {actionText}
                </Button>
              </Section>
            )}
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footerText}>
              Esta é uma notificação automática do sistema SoMA+.
            </Text>
            <Text style={footerText}>
              Se você não esperava este email, pode ignorá-lo com segurança.
            </Text>
            <Text style={footerLinks}>
              <Link href="https://pla.soma.lefil.com.br" style={footerLink}>
                Acessar SoMA+
              </Link>
              {'  ·  '}
              <Link href="https://pla.soma.lefil.com.br/settings" style={footerLink}>
                Configurações
              </Link>
            </Text>
            <Text style={copyright}>
              © {new Date().getFullYear()} SoMA+. Todos os direitos reservados.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default NotificationEmail

// Styles — Dark theme
const main = {
  backgroundColor: BRAND.ink,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  margin: '0',
  padding: '0',
}

const container = {
  margin: '0 auto',
  padding: '24px 0 32px',
  maxWidth: '600px',
  backgroundColor: BRAND.ink,
}

const headerSection = {
  backgroundColor: BRAND.ink,
  borderRadius: '12px 12px 0 0',
  padding: '32px 40px 24px',
  textAlign: 'center' as const,
  borderTop: `1px solid ${BRAND.border}`,
  borderLeft: `1px solid ${BRAND.border}`,
  borderRight: `1px solid ${BRAND.border}`,
}

const logo = {
  margin: '0 auto',
  display: 'block',
  maxWidth: '160px',
  height: 'auto' as const,
}

const accentBar = {
  height: '4px',
  width: '100%',
  borderLeft: `1px solid ${BRAND.border}`,
  borderRight: `1px solid ${BRAND.border}`,
}

const contentSection = {
  backgroundColor: BRAND.surface,
  padding: '36px 40px 12px',
  borderLeft: `1px solid ${BRAND.border}`,
  borderRight: `1px solid ${BRAND.border}`,
}

const greeting = {
  color: BRAND.mutedText,
  fontSize: '14px',
  margin: '0 0 8px',
}

const heading = {
  color: BRAND.white,
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 16px',
}

const messageText = {
  color: BRAND.bodyText,
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 24px',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '8px 0 28px',
}

const button = {
  borderRadius: '8px',
  color: BRAND.white,
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

const divider = {
  borderColor: BRAND.border,
  margin: '0',
}

const footerSection = {
  backgroundColor: BRAND.surfaceSoft,
  borderRadius: '0 0 12px 12px',
  padding: '24px 40px 28px',
  textAlign: 'center' as const,
  borderLeft: `1px solid ${BRAND.border}`,
  borderRight: `1px solid ${BRAND.border}`,
  borderBottom: `1px solid ${BRAND.border}`,
}

const footerText = {
  color: BRAND.mutedText,
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 6px',
  textAlign: 'center' as const,
}

const footerLinks = {
  color: BRAND.mutedText,
  fontSize: '12px',
  margin: '14px 0 8px',
  textAlign: 'center' as const,
}

const footerLink = {
  color: BRAND.primaryLight,
  textDecoration: 'none',
  fontWeight: '600',
}

const copyright = {
  color: BRAND.mutedText,
  fontSize: '11px',
  margin: '12px 0 0',
  textAlign: 'center' as const,
}
