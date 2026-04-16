# Firebase Cloud Functions para EuPago

Este documento contém as Firebase Cloud Functions necessárias para integrar pagamentos EuPago no RealRateMe.

## Setup Necessário

### 1. Variáveis de Ambiente

Adiciona estas variáveis de ambiente às tuas Firebase Functions:

```bash
firebase functions:config:set eupago.api_key="0c63-951d-a976-ea4f-1684"
firebase functions:config:set eupago.api_base_url="https://clientes.eupago.pt"
```

### 2. Instalar Dependências

No diretório `functions/`:

```bash
npm install axios
```

### 3. Estrutura de Ficheiros

```
functions/
├── src/
│   ├── index.ts
│   ├── createMbWayPayment.ts
│   ├── createMultibancoPayment.ts
│   └── eupagoWebhook.ts
└── package.json
```

## Código das Functions

### `functions/src/createMbWayPayment.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const EUPAGO_API_KEY = functions.config().eupago.api_key;
const EUPAGO_BASE_URL = functions.config().eupago.api_base_url;

export const createMbWayPayment = functions.https.onCall(async (data, context) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { planId, amount, phone, email, userId } = data;

  // Validação
  if (!planId || !amount || !phone || !email) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  const db = admin.firestore();

  try {
    // Criar identificador único para o pagamento
    const identifier = `RRM-${Date.now()}-${userId.substring(0, 8)}`;

    // Criar documento de pagamento no Firestore
    const paymentRef = await db.collection('payments').add({
      userId,
      userEmail: email,
      plan: planId,
      amount: parseFloat(amount),
      method: 'MBWay',
      status: 'Pending',
      identifier,
      userPhone: phone,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const paymentId = paymentRef.id;

    // Chamar API EuPago para criar pagamento MB WAY
    const eupagoResponse = await axios.post(
      `${EUPAGO_BASE_URL}/api/v1.02/mbway/create`,
      {
        payment: {
          identifier: identifier,
          amount: {
            value: parseFloat(amount).toFixed(2),
            currency: 'EUR',
          },
          customerPhone: phone,
          countryCode: '351',
          lang: 'PT',
          successUrl: `https://www.realrateme.me/payment-success?method=mbway&paymentId=${paymentId}`,
          failUrl: `https://www.realrateme.me/payment-failed?method=mbway`,
          backUrl: `https://www.realrateme.me/pricing`,
          notificationUrl: `https://us-central1-[YOUR-PROJECT-ID].cloudfunctions.net/eupagoWebhook`,
        },
        customer: {
          notify: false,
          email: email,
        },
      },
      {
        headers: {
          Authorization: `ApiKey ${EUPAGO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Atualizar documento com resposta EuPago
    await paymentRef.update({
      eupagoResponse: eupagoResponse.data,
      eupagoTransactionId: eupagoResponse.data.transactionID || null,
      eupagoReference: eupagoResponse.data.reference || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('MB WAY payment created:', paymentId);

    return {
      success: true,
      paymentId,
      transactionId: eupagoResponse.data.transactionID,
    };
  } catch (error: any) {
    console.error('Error creating MB WAY payment:', error);

    // Se já criamos o documento, marcar como falhado
    if (error.paymentId) {
      await db.collection('payments').doc(error.paymentId).update({
        status: 'Failed',
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Failed to create MB WAY payment'
    );
  }
});
```

### `functions/src/createMultibancoPayment.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const EUPAGO_API_KEY = functions.config().eupago.api_key;
const EUPAGO_BASE_URL = functions.config().eupago.api_base_url;

export const createMultibancoPayment = functions.https.onCall(async (data, context) => {
  // Verificar autenticação
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { planId, amount, email, userId } = data;

  // Validação
  if (!planId || !amount || !email) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  const db = admin.firestore();

  try {
    // Criar identificador único para o pagamento
    const identifier = `RRM-${Date.now()}-${userId.substring(0, 8)}`;

    // Criar documento de pagamento no Firestore
    const paymentRef = await db.collection('payments').add({
      userId,
      userEmail: email,
      plan: planId,
      amount: parseFloat(amount),
      method: 'Multibanco',
      status: 'Pending',
      identifier,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const paymentId = paymentRef.id;

    // Chamar API EuPago para criar referência Multibanco
    // IMPORTANTE: Multibanco usa autenticação no body (chave), NÃO no header!
    const eupagoResponse = await axios.post(
      `${EUPAGO_BASE_URL}/clientes/rest_api/multibanco/create`,
      {
        chave: EUPAGO_API_KEY, // API Key no body!
        valor: parseFloat(amount),
        id: identifier,
        per_dup: 0, // 0 = não permitir duplicados
        email: email,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
      }
    );

    const responseData = eupagoResponse.data;

    // Calcular data de expiração (7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Atualizar documento com referência Multibanco
    await paymentRef.update({
      entity: responseData.entidade,
      reference: responseData.referencia,
      eupagoResponse: responseData,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Multibanco payment created:', paymentId);

    return {
      success: true,
      paymentId,
      entity: responseData.entidade,
      reference: responseData.referencia,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error: any) {
    console.error('Error creating Multibanco payment:', error);

    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Failed to create Multibanco payment'
    );
  }
});
```

### `functions/src/eupagoWebhook.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const eupagoWebhook = functions.https.onRequest(async (req, res) => {
  // Apenas aceitar POST requests
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const db = admin.firestore();

  try {
    const { identificador, estado, metodo, valor } = req.body;

    console.log('EuPago Webhook received:', {
      identificador,
      estado,
      metodo,
      valor,
    });

    // Encontrar pagamento pelo identificador
    const paymentsQuery = await db
      .collection('payments')
      .where('identifier', '==', identificador)
      .limit(1)
      .get();

    if (paymentsQuery.empty) {
      console.error('Payment not found for identifier:', identificador);
      res.status(404).send('Payment not found');
      return;
    }

    const paymentDoc = paymentsQuery.docs[0];
    const paymentId = paymentDoc.id;
    const payment = paymentDoc.data();

    // Atualizar status do pagamento baseado no webhook
    let newStatus = 'Pending';

    if (estado === 'success' || estado === 'paid') {
      newStatus = 'Paid';
    } else if (estado === 'failed' || estado === 'error') {
      newStatus = 'Failed';
    } else if (estado === 'cancelled') {
      newStatus = 'Cancelled';
    }

    // Atualizar documento de pagamento
    await paymentDoc.ref.update({
      status: newStatus,
      paidAt: newStatus === 'Paid' ? admin.firestore.FieldValue.serverTimestamp() : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Se pagamento foi bem-sucedido, criar/atualizar subscrição
    if (newStatus === 'Paid') {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // 1 ano de subscrição

      // Criar documento de subscrição
      await db.collection('subscriptions').doc(payment.userId).set({
        userId: payment.userId,
        plan: payment.plan,
        status: 'active',
        startDate: admin.firestore.Timestamp.fromDate(startDate),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        paymentId: paymentId,
        autoRenew: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Atualizar plano do usuário (se for professional)
      if (payment.plan.startsWith('professional-')) {
        // Encontrar todos os perfis profissionais do usuário
        const professionalsQuery = await db
          .collection('professionals')
          .where('userId', '==', payment.userId)
          .get();

        // Atualizar plano de todos os perfis
        const planName = payment.plan.replace('professional-', '');
        const batch = db.batch();

        professionalsQuery.docs.forEach((doc) => {
          batch.update(doc.ref, {
            plan: planName,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
      }

      // Se for place owner, atualizar places
      if (payment.plan.startsWith('place-')) {
        // Encontrar User document
        const userDoc = await db.collection('users').doc(payment.userId).get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          const ownedPlaceIds = userData?.ownedPlaceIds || [];

          // Atualizar isPremium de todos os places
          const batch = db.batch();

          ownedPlaceIds.forEach((placeId: string) => {
            const placeRef = db.collection('places').doc(placeId);
            batch.update(placeRef, {
              isPremium: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });

          await batch.commit();
        }
      }

      console.log('Subscription created for user:', payment.userId);
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});
```

### `functions/src/index.ts`

```typescript
import * as admin from 'firebase-admin';

admin.initializeApp();

export { createMbWayPayment } from './createMbWayPayment';
export { createMultibancoPayment } from './createMultibancoPayment';
export { eupagoWebhook } from './eupagoWebhook';
```

## Deploy

```bash
# Primeiro, configurar variáveis de ambiente
firebase functions:config:set eupago.api_key="0c63-951d-a976-ea4f-1684"
firebase functions:config:set eupago.api_base_url="https://clientes.eupago.pt"

# Deploy das functions
firebase deploy --only functions
```

## IMPORTANTE: Configurar Webhook no EuPago

Depois do deploy, configurar no backoffice EuPago:

**Notification URL**: `https://us-central1-[YOUR-PROJECT-ID].cloudfunctions.net/eupagoWebhook`

Substitui `[YOUR-PROJECT-ID]` pelo ID do teu projeto Firebase.

## Testar

### MB WAY (Desenvolvimento)
- Usar número de teste: `#96#96#2118`
- Este número aprova automaticamente o pagamento

### Multibanco (Desenvolvimento)
- A referência gerada pode ser paga em qualquer ATM ou homebanking

## Páginas de Sucesso/Erro

Ainda precisas de criar estas páginas no frontend:
- `/payment-success` - Mostra sucesso do pagamento
- `/payment-failed` - Mostra falha do pagamento
- `/payment-multibanco` - Mostra entidade e referência Multibanco

## Estrutura Firestore

### Coleção: `payments`
```typescript
{
  id: string (auto-generated)
  userId: string
  userEmail: string
  plan: string (e.g., "professional-pro")
  amount: number
  method: "MBWay" | "Multibanco"
  status: "Pending" | "Paid" | "Failed" | "Cancelled"
  identifier: string

  // MB WAY específico
  userPhone?: string
  eupagoTransactionId?: string
  eupagoReference?: string

  // Multibanco específico
  entity?: string
  reference?: string
  expiresAt?: Timestamp

  eupagoResponse?: any
  createdAt: Timestamp
  updatedAt: Timestamp
  paidAt?: Timestamp
}
```

### Coleção: `subscriptions`
```typescript
{
  userId: string (document ID)
  plan: string
  status: "active" | "expired" | "cancelled"
  startDate: Timestamp
  endDate: Timestamp (1 year from start)
  paymentId: string
  autoRenew: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

## Regras de Segurança Firestore

Adicionar ao `firestore.rules`:

```javascript
match /payments/{paymentId} {
  allow read: if request.auth != null &&
    request.auth.uid == resource.data.userId;
  allow create: if request.auth != null;
  allow update: if false; // Apenas via Cloud Functions
}

match /subscriptions/{userId} {
  allow read: if request.auth != null &&
    request.auth.uid == userId;
  allow write: if false; // Apenas via Cloud Functions
}
```
