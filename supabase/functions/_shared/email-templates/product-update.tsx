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

export interface ProductUpdateEmailProps {
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  userName?: string;
  imageUrl?: string;
}


const BRAND = {
  primary: '#F28705',
  primaryLight: '#F29F05',
  white: '#FFFFFF',
  ink: '#1D1D1D',
  bodyText: '#3F3F3F',
  mutedText: '#8A8A8A',
  border: '#E6E6E6',
  softBg: '#FBFBFB',
}

const LOGO_URL =
  'https://pla.soma.lefil.com.br/__l5e/assets-v1/06d95757-da83-483e-8bf1-87e39df78686/soma-logo.png'

export const ProductUpdateEmail = ({
  title,
  message,
  actionUrl,
  actionText = 'Conhecer novidade',
  userName,
}: ProductUpdateEmailProps) => (
  <Html>
    <Head />
    <Preview>{title}</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Orange top bar */}
        <div style={topBar} />

        <Section style={kickerSection}>
          <Text style={kicker}>NOVA ATUALIZAÇÃO NO SOMA+</Text>
        </Section>

        <Section style={contentSection}>
          {userName && <Text style={greeting}>Olá, {userName}!</Text>}

          <table
            role="presentation"
            cellPadding={0}
            cellSpacing={0}
            style={headingTable}
          >
            <tbody>
              <tr>
                <td style={headingBar} />
                <td style={headingCell}>
                  <Heading style={heading}>{title}</Heading>
                </td>
              </tr>
            </tbody>
          </table>

          <Text style={messageText}>{message}</Text>

          {actionUrl && (
            <Section style={buttonSection}>
              <Button style={button} href={actionUrl}>
                {actionText}
              </Button>
            </Section>
          )}
        </Section>

        <Section style={logoSection}>
          <Img src={LOGO_URL} alt="SoMA+" width="150" height="auto" style={logo} />
        </Section>

        <Hr style={divider} />

        <Section style={footerSection}>
          <Text style={footerText}>
            Você recebeu este e-mail porque acompanha as novidades do SoMA+.
          </Text>
          <Text style={footerLinks}>
            <Link href="https://pla.soma.lefil.com.br" style={footerLink}>
              Acessar SoMA+
            </Link>
            {'  ·  '}
            <Link href="https://pla.soma.lefil.com.br/settings" style={footerLink}>
              Preferências de notificação
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

export default ProductUpdateEmail

const main = {
  backgroundColor: '#F2F2F2',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
  margin: '0',
  padding: '0',
}

const container = {
  margin: '0 auto',
  padding: '0 0 24px',
  maxWidth: '600px',
  backgroundColor: BRAND.white,
}

const topBar = {
  height: '14px',
  width: '100%',
  backgroundColor: BRAND.primary,
}

const kickerSection = {
  padding: '36px 40px 8px',
  textAlign: 'center' as const,
}

const kicker = {
  color: BRAND.ink,
  fontSize: '17px',
  fontWeight: '500',
  letterSpacing: '4px',
  lineHeight: '1.4',
  margin: '0',
  textAlign: 'center' as const,
  textTransform: 'uppercase' as const,
}

const contentSection = {
  padding: '20px 40px 8px',
}

const greeting = {
  color: BRAND.mutedText,
  fontSize: '14px',
  margin: '0 0 12px',
}

const headingTable = {
  borderCollapse: 'collapse' as const,
  width: '100%',
  margin: '0 0 16px',
}

const headingBar = {
  backgroundColor: BRAND.primary,
  width: '5px',
  borderRadius: '3px',
}

const headingCell = {
  paddingLeft: '14px',
}

const heading = {
  color: BRAND.ink,
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '1.25',
  margin: '0',
}

const messageText = {
  color: BRAND.bodyText,
  fontSize: '16px',
  lineHeight: '1.7',
  margin: '0 0 24px',
}

const buttonSection = {
  margin: '4px 0 20px',
}

const button = {
  backgroundColor: BRAND.primary,
  borderRadius: '8px',
  color: BRAND.white,
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
}

const logoSection = {
  backgroundColor: BRAND.softBg,
  padding: '28px 40px',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0 auto',
  display: 'block',
  maxWidth: '150px',
  height: 'auto' as const,
}

const divider = {
  borderColor: BRAND.border,
  margin: '0',
}

const footerSection = {
  padding: '20px 40px 8px',
  textAlign: 'center' as const,
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
  margin: '10px 0 6px',
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
  margin: '10px 0 0',
  textAlign: 'center' as const,
}
