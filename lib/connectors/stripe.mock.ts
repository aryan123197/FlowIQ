import { BaseConnector, type RawCustomer, type RawTransaction } from './base'

const MOCK_CUSTOMERS = [
  {
    id: 'cus_mock_001',
    email: 'ethan.davis@example.com',
    name: 'Ethan Davis',
    phone: null,
    metadata: {},
  },
  {
    id: 'cus_mock_002',
    email: 'isabella.martinez@example.com',
    name: 'Isabella Martinez',
    phone: null,
    metadata: {},
  },
  {
    id: 'cus_mock_003',
    email: 'mason.lee@example.com',
    name: 'Mason Lee',
    phone: null,
    metadata: {},
  },
  {
    id: 'cus_mock_004',
    email: 'mia.anderson@example.com',
    name: 'Mia Anderson',
    phone: null,
    metadata: {},
  },
]

const MOCK_CHARGES = [
  {
    id: 'ch_mock_001',
    amount: 4999,
    currency: 'usd',
    status: 'succeeded',
    created: 1717200000,
    customer: null,
    billing_details: { email: 'ethan.davis@example.com' },
  },
  {
    id: 'ch_mock_002',
    amount: 12000,
    currency: 'usd',
    status: 'succeeded',
    created: 1717800000,
    customer: null,
    billing_details: { email: 'isabella.martinez@example.com' },
  },
  {
    id: 'ch_mock_003',
    amount: 2500,
    currency: 'usd',
    status: 'failed',
    created: 1718400000,
    customer: null,
    billing_details: { email: 'mason.lee@example.com' },
  },
  {
    id: 'ch_mock_004',
    amount: 8800,
    currency: 'usd',
    status: 'succeeded',
    created: 1719000000,
    customer: null,
    billing_details: { email: 'mia.anderson@example.com' },
  },
  {
    id: 'ch_mock_005',
    amount: 3300,
    currency: 'usd',
    status: 'refunded',
    created: 1719600000,
    customer: null,
    billing_details: { email: 'ethan.davis@example.com' },
  },
  {
    id: 'ch_mock_006',
    amount: 15750,
    currency: 'usd',
    status: 'succeeded',
    created: 1720200000,
    customer: null,
    billing_details: { email: 'isabella.martinez@example.com' },
  },
]

export class StripeMockConnector extends BaseConnector {
  readonly platform = 'stripe' as const

  async validate(): Promise<void> {}

  async *fetchCustomers(): AsyncGenerator<RawCustomer[]> {
    yield MOCK_CUSTOMERS
  }

  async *fetchTransactions(): AsyncGenerator<RawTransaction[]> {
    yield MOCK_CHARGES
  }
}
