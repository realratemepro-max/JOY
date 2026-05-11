# Launch Checklist — JOY Yoga

Última auditoria: 2026-04-26

## Estado do CRM (18 páginas funcionais)

| Página | Estado | Notas |
|---|---|---|
| Dashboard | OK | KPIs (clientes, receita, próximas aulas, pagamentos) |
| Espaços | OK | CRUD + custos por slot + pagamentos mensais |
| Professores | OK | CRUD + portal account + permissões + ganhos |
| Planos | OK | Subscription/dropin + features + binding ao espaço |
| Aulas | OK | Calendário + criar/editar/cancelar/substituir + presenças + Zoom |
| Aulas Privadas | OK | Pedidos com confirmação data/hora/professor |
| Clientes | OK | Lista + invite + detalhe com compras/créditos |
| Compras | OK | CRUD + filtros + ajustar validade/sessões + apagar |
| Pagamentos | OK | Lista + filtros + editar status + apagar |
| Códigos Promo | OK | CRUD + redemptions + expiry |
| Vales Oferta | OK | Gerar códigos + tracking |
| Referências | OK | Config + lista de referrals |
| Eventos | OK | CRUD com foto/capacidade/features |
| Biblioteca | OK | Vídeo/áudio + YouTube/Vimeo + premium |
| Notificações | OK | Templates por trigger + canais |
| Site/Conteúdo | OK | Hero, Sobre, Práticas, Serviços, etc. |
| Mensagens | OK | Chat real-time admin↔cliente |
| Testemunhos | OK | Aprovar ratings → publicar como testemunho |

## Pré-Lançamento — CRÍTICO (RGPD/segurança)

- [x] **1. Páginas Privacidade e Termos** — `/privacidade` + `/termos`, ConsentGate para users existentes, checkbox no registo
- [x] **2. Cookie banner** — RGPD
- [x] **3. EuPago em produção** — confirmado por testes reais
- [x] **4. Email** — Resend a funcionar (professor invite + Plano Comprado entregues)
- [x] **5. Backups Firestore** — Cloud Function diária 03:00 + bucket + retenção 30d
- [x] **6. Rate limiting nas Cloud Functions** — payments + giftcard + promo + testEmail

## Pré-Lançamento — IMPORTANTE (qualidade)

- [x] Validação de email duplicado nos invites (admin professores + clientes)
- [x] Validação de números negativos em preços/capacidades
- [x] Tratamento de erros com toasts em vez de console.error silenciosos (ToastProvider global)
- [ ] Analytics (Plausible/Umami) para medir conversões
- [ ] Audit AdminSessions.tsx (1500 linhas) — testar todos os flows complexos
- [ ] Teste end-to-end completo: aluno + professor + admin

## Pós-Lançamento (nice-to-have)

- [ ] Operações bulk (importar clientes via CSV, mass-email)
- [ ] Audit log de mudanças de permissões
- [ ] Múltiplos roles de admin com granularidade
- [ ] Refactor AdminSessions para componentes mais pequenos
- [x] Programa de Fidelidade gamificado (4 presets + editável + toast de subida de nível)
- [ ] Página /app/conquistas com galeria de níveis

## Histórico de decisões

- 2026-04-26 — Auditoria inicial: 18 páginas admin funcionais. CRM core completo.
- 2026-04-26 — Decisão: lançar após fechar itens 1-4. Itens 5-6 podem ir 1-2 semanas após.
