import { BaseConnector, type RawCustomer, type RawTransaction } from './base'

const MOCK_CONTACTS = [
  { Id: 'sf_cont_001', Email: 'noah.williams@acmecorp.com', Name: 'Noah Williams', AccountId: 'sf_acc_001', CreatedDate: '2023-11-10T10:00:00Z' },
  { Id: 'sf_cont_002', Email: 'ava.garcia@globex.com', Name: 'Ava Garcia', AccountId: 'sf_acc_002', CreatedDate: '2024-01-05T12:00:00Z' },
  { Id: 'sf_cont_003', Email: 'william.smith@initech.com', Name: 'William Smith', AccountId: 'sf_acc_003', CreatedDate: '2024-02-14T09:00:00Z' },
]

const MOCK_OPPORTUNITIES = [
  { Id: 'sf_opp_001', ContactId: 'sf_cont_001', ContactEmail: 'noah.williams@acmecorp.com', Name: 'Acme Corp - Enterprise License', Amount: 12500.00, StageName: 'Closed Won', CloseDate: '2024-05-30', CurrencyIsoCode: 'USD' },
  { Id: 'sf_opp_002', ContactId: 'sf_cont_002', ContactEmail: 'ava.garcia@globex.com', Name: 'Globex Corp - Premium Plan', Amount: 4800.00, StageName: 'Closed Won', CloseDate: '2024-06-15', CurrencyIsoCode: 'USD' },
  { Id: 'sf_opp_003', ContactId: 'sf_cont_003', ContactEmail: 'william.smith@initech.com', Name: 'Initech - Starter Bundle', Amount: 1200.00, StageName: 'Closed Won', CloseDate: '2024-06-28', CurrencyIsoCode: 'USD' },
  { Id: 'sf_opp_004', ContactId: 'sf_cont_001', ContactEmail: 'noah.williams@acmecorp.com', Name: 'Acme Corp - Add-on Modules', Amount: 3500.00, StageName: 'Closed Won', CloseDate: '2024-07-10', CurrencyIsoCode: 'USD' },
  { Id: 'sf_opp_005', ContactId: 'sf_cont_002', ContactEmail: 'ava.garcia@globex.com', Name: 'Globex Corp - Renewal', Amount: 4800.00, StageName: 'Closed Lost', CloseDate: '2024-07-25', CurrencyIsoCode: 'USD' },
]

export class SalesforceMockConnector extends BaseConnector {
  readonly platform = 'salesforce' as const

  async validate(): Promise<void> {}

  async *fetchCustomers(): AsyncGenerator<RawCustomer[]> {
    yield MOCK_CONTACTS
  }

  async *fetchTransactions(): AsyncGenerator<RawTransaction[]> {
    yield MOCK_OPPORTUNITIES.filter(o => o.StageName === 'Closed Won')
  }
}
