import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import type { TemplateEntry } from './registry'

interface CredentialsProps {
  nome?: string
  email?: string
  senha?: string
  loginUrl?: string
}

export function CredentialsEmail({
  nome = 'usuário',
  email = 'seu-email@exemplo.com',
  senha = '••••••••••',
  loginUrl = 'https://ocrq.info/login',
}: CredentialsProps) {
  return (
    <Html>
      <Head />
      <Preview>Suas credenciais de acesso ao sistema de pedidos</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px' }}>
          <Heading style={{ fontSize: 22, color: '#0f172a', margin: 0 }}>
            Bem-vindo(a), {nome}!
          </Heading>
          <Text style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
            Sua conta foi criada no Sistema de Pedidos. Use as credenciais abaixo para
            acessar:
          </Text>

          <Section
            style={{
              backgroundColor: '#f1f5f9',
              borderRadius: 8,
              padding: '16px 20px',
              margin: '20px 0',
            }}
          >
            <Text style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>
              <strong>Email:</strong> {email}
            </Text>
            <Text style={{ fontSize: 13, color: '#475569', margin: '4px 0' }}>
              <strong>Senha temporária:</strong>{' '}
              <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{senha}</span>
            </Text>
          </Section>

          <Text style={{ fontSize: 14, color: '#334155', lineHeight: 1.6 }}>
            Acesse o sistema em:{' '}
            <a href={loginUrl} style={{ color: '#1e5a9e' }}>
              {loginUrl}
            </a>
          </Text>

          <Text style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            Recomendamos alterar a senha após o primeiro login. Não compartilhe estas
            credenciais com terceiros.
          </Text>

          <Hr style={{ borderColor: '#e2e8f0', margin: '24px 0' }} />
          <Text style={{ fontSize: 11, color: '#94a3b8' }}>
            Esta é uma mensagem automática — não responda a este email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CredentialsEmail,
  subject: 'Suas credenciais de acesso ao Sistema de Pedidos',
  displayName: 'Credenciais de acesso',
  previewData: {
    nome: 'Maria Vendedora',
    email: 'maria@cliente.com',
    senha: 'Xy7k!mP2qR9w',
    loginUrl: 'https://ocrq.info/login',
  },
} satisfies TemplateEntry
