import { BaseConnector, type RawCustomer, type RawTransaction } from './base'

const MOCK_CUSTOMERS = [
  { id: 'shp_cust_001', email: 'emma.watson@example.com', first_name: 'Emma', last_name: 'Watson', created_at: '2024-01-15T10:00:00Z' },
  { id: 'shp_cust_002', email: 'james.miller@example.com', first_name: 'James', last_name: 'Miller', created_at: '2024-02-20T12:00:00Z' },
  { id: 'shp_cust_003', email: 'sophia.chen@example.com', first_name: 'Sophia', last_name: 'Chen', created_at: '2024-03-05T09:00:00Z' },
  { id: 'shp_cust_004', email: 'liam.johnson@example.com', first_name: 'Liam', last_name: 'Johnson', created_at: '2024-03-22T15:00:00Z' },
  { id: 'shp_cust_005', email: 'olivia.brown@example.com', first_name: 'Olivia', last_name: 'Brown', created_at: '2024-04-10T11:00:00Z' },
]

const MOCK_ORDERS = [
  { id: 'shp_ord_001', customer_id: 'shp_cust_001', email: 'emma.watson@example.com', total_price: '149.99', currency: 'USD', financial_status: 'paid', created_at: '2024-06-01T10:30:00Z' },
  { id: 'shp_ord_002', customer_id: 'shp_cust_002', email: 'james.miller@example.com', total_price: '89.50', currency: 'USD', financial_status: 'paid', created_at: '2024-06-05T14:00:00Z' },
  { id: 'shp_ord_003', customer_id: 'shp_cust_003', email: 'sophia.chen@example.com', total_price: '229.00', currency: 'USD', financial_status: 'paid', created_at: '2024-06-10T09:15:00Z' },
  { id: 'shp_ord_004', customer_id: 'shp_cust_001', email: 'emma.watson@example.com', total_price: '55.00', currency: 'USD', financial_status: 'refunded', created_at: '2024-06-15T16:00:00Z' },
  { id: 'shp_ord_005', customer_id: 'shp_cust_004', email: 'liam.johnson@example.com', total_price: '320.75', currency: 'USD', financial_status: 'paid', created_at: '2024-07-01T11:30:00Z' },
  { id: 'shp_ord_006', customer_id: 'shp_cust_005', email: 'olivia.brown@example.com', total_price: '175.00', currency: 'USD', financial_status: 'paid', created_at: '2024-07-08T13:45:00Z' },
  { id: 'shp_ord_007', customer_id: 'shp_cust_002', email: 'james.miller@example.com', total_price: '420.00', currency: 'USD', financial_status: 'paid', created_at: '2024-07-15T10:00:00Z' },
  { id: 'shp_ord_008', customer_id: 'shp_cust_003', email: 'sophia.chen@example.com', total_price: '99.99', currency: 'USD', financial_status: 'pending', created_at: '2024-07-20T09:00:00Z' },
]

export class ShopifyMockConnector extends BaseConnector {
  readonly platform = 'shopify' as const

  async validate(): Promise<void> {}

  async *fetchCustomers(): AsyncGenerator<RawCustomer[]> {
    yield MOCK_CUSTOMERS
  }

  async *fetchTransactions(): AsyncGenerator<RawTransaction[]> {
    yield MOCK_ORDERS
  }
}
