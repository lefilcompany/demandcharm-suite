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

export const NotificationEmail = ({
  title,
  message,
  actionUrl,
  actionText = 'Ver Detalhes',
  userName,
  type = 'info',
}: NotificationEmailProps) => {
  const getTypeColor = () => {
    switch (type) {
      case 'success':
        return '#10B981'
      case 'warning':
        return '#F59E0B'
      case 'error':
        return '#EF4444'
      default:
        return '#F28705'
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
            <table width="100%" cellPadding="0" cellSpacing="0">
              <tr>
                <td align="center">
                  <Img
                    src="https://pla.soma.lefil.com.br/lovable-uploads/8967ad53-156a-4e31-a5bd-b472b7cde839.png"
                    alt="SoMA+"
                    width="150"
                    height="50"
                    style={{ margin: '0 auto' }}
                  />
                </td>
              </tr>
            </table>
          </Section>

          {/* Accent bar */}
          <div style={{ ...accentBar, backgroundColor: accentColor }} />

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
            <Link href="https://pla.soma.lefil.com.br" style={mainLink}>
              Acessar SoMA+
            </Link>
            <Text style={footerLinks}>
              <Link href="https://pla.soma.lefil.com.br/settings" style={footerLink}>
                Configurações de Notificação
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

// Styles
const main = {
  backgroundColor: '#F5F5F5',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '20px 0',
  maxWidth: '600px',
}

const headerSection = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px 12px 0 0',
  padding: '32px 40px 24px',
}

const accentBar = {
  height: '4px',
  width: '100%',
}

const contentSection = {
  backgroundColor: '#FFFFFF',
  padding: '32px 40px',
}

const greeting = {
  color: '#6B7280',
  fontSize: '14px',
  margin: '0 0 8px',
}

const heading = {
  color: '#1D1D1D',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 16px',
}

const messageText = {
  color: '#4B5563',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 24px',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const button = {
  borderRadius: '8px',
  color: '#FFFFFF',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

const divider = {
  borderColor: '#E5E7EB',
  margin: '0',
}

const footerSection = {
  backgroundColor: '#FFFFFF',
  borderRadius: '0 0 12px 12px',
  padding: '24px 40px 32px',
}

const footerText = {
  color: '#9CA3AF',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 8px',
  textAlign: 'center' as const,
}

const footerLinks = {
  color: '#9CA3AF',
  fontSize: '12px',
  margin: '16px 0 8px',
  textAlign: 'center' as const,
}

const footerLink = {
  color: '#F28705',
  textDecoration: 'none',
}

const mainLink = {
  color: '#FFFFFF',
  backgroundColor: '#F28705',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  margin: '16px 0',
}

const copyright = {
  color: '#9CA3AF',
  fontSize: '11px',
  margin: '16px 0 0',
  textAlign: 'center' as const,
}
