import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gqudxeaxdgjdmzouahfb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_y9NFCnzCWXA_PCYM1K-pKA_DtHSbQSY';
const email = process.env.SIXMIN_QA_EMAIL;
const password = process.env.SIXMIN_QA_PASSWORD;
const prefix = process.env.SIXMIN_QA_PREFIX ?? 'Smoke Client ';

if (!email || !password) {
  console.error('Set SIXMIN_QA_EMAIL and SIXMIN_QA_PASSWORD');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
if (authError) throw authError;
const userId = auth.user.id;

const nowIso = new Date().toISOString();
const { error: closeActiveError } = await supabase
  .from('entries')
  .update({ end_at: nowIso, paused_at: null })
  .eq('user_id', userId)
  .is('end_at', null);
if (closeActiveError) throw closeActiveError;

const { data: clients, error: clientsError } = await supabase
  .from('clients')
  .select('id,name')
  .eq('user_id', userId)
  .ilike('name', `${prefix}%`);
if (clientsError) throw clientsError;

const clientIds = (clients ?? []).map((c) => c.id);
let cleanedDraftInvoices = 0;
let preservedHistoricalInvoices = 0;

if (clientIds.length > 0) {
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('id,status')
    .eq('user_id', userId)
    .in('client_id', clientIds);
  if (invoicesError) throw invoicesError;

  const draftInvoiceIds = (invoices ?? []).filter((invoice) => invoice.status === 'draft').map((invoice) => invoice.id);
  preservedHistoricalInvoices = (invoices ?? []).filter((invoice) => invoice.status !== 'draft').length;

  if (draftInvoiceIds.length > 0) {
    await supabase.from('invoice_delivery_audit').delete().in('invoice_id', draftInvoiceIds);
    await supabase.from('invoice_line_items').delete().in('invoice_id', draftInvoiceIds);
    await supabase.from('expenses').update({ invoice_id: null, status: 'unbilled' }).in('invoice_id', draftInvoiceIds);
    await supabase.from('entries').update({ invoice_id: null, billed: false }).in('invoice_id', draftInvoiceIds);
    const { error: draftDeleteError } = await supabase.from('invoices').delete().in('id', draftInvoiceIds);
    if (!draftDeleteError) {
      cleanedDraftInvoices = draftInvoiceIds.length;
    }
  }
}

console.log(JSON.stringify({
  email,
  closedActiveEntries: true,
  matchedSmokeClients: clientIds.length,
  cleanedDraftInvoices,
  preservedHistoricalInvoices,
}, null, 2));
