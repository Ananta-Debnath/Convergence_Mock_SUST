// The five public sample tickets from the task brief. Used by both the
// unit tests and the eval script so expectations live in one place.

export const PUBLIC_CASES = [
  {
    id: 'public-1-phishing-otp',
    ticket_id: 'T-PUB-1',
    message:
      'Someone is asking for my OTP over the phone and says they are from bKash. Is that bKash?',
    expected: {
      case_type: 'phishing_or_social_engineering',
      severity: 'critical',
      department: 'fraud_risk',
      human_review_required: true,
    },
  },
  {
    id: 'public-2-wrong-transfer',
    ticket_id: 'T-PUB-2',
    message:
      'I sent 7000 taka to the wrong number by mistake, please help me get it back.',
    expected: {
      case_type: 'wrong_transfer',
      severity: 'critical',
      department: 'dispute_resolution',
      human_review_required: true,
    },
  },
  {
    id: 'public-3-payment-failed',
    ticket_id: 'T-PUB-3',
    message:
      'My payment failed but the amount was deducted from my account. The transaction shows failed.',
    expected: {
      case_type: 'payment_failed',
      severity: 'high',
      department: 'payments_ops',
    },
  },
  {
    id: 'public-4-refund',
    ticket_id: 'T-PUB-4',
    message:
      'I want a refund for my last order, the product never arrived and I want my money back.',
    expected: {
      case_type: 'refund_request',
      severity: 'medium',
      department: 'customer_support',
    },
  },
  {
    id: 'public-5-other',
    ticket_id: 'T-PUB-5',
    message: 'How do I change the language of the app to Bangla?',
    expected: {
      case_type: 'other',
      severity: 'low',
      department: 'customer_support',
    },
  },
];
