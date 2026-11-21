import {buildTestCommissionSamples} from './test-commission-samples.js';
export function installTestCommissionExamples(app,{enabled,requireRole,build=buildTestCommissionSamples}){
 let pending;const samples=()=>pending||(pending=build().catch(e=>{pending=null;throw e;}));
 app.get('/api/supplier/accounting/test-examples',requireRole('supplier','admin'),(req,res)=>{
  if(!enabled())return res.status(404).end();res.set('Cache-Control','private, no-store');
  res.json({synthetic:true,realSeriesUsed:false,documents:[{kind:'invoice',number:'TEST-RIO-2026-000001',amountCents:1500,url:'/api/supplier/accounting/test-examples/invoice.pdf'},{kind:'credit',number:'TEST-RIO-2026-000002',amountCents:500,originalNumber:'TEST-RIO-2026-000001',url:'/api/supplier/accounting/test-examples/credit.pdf'}]});
 });
 app.get('/api/supplier/accounting/test-examples/:kind.pdf',requireRole('supplier','admin'),async(req,res)=>{
  if(!enabled()||!['invoice','credit'].includes(req.params.kind))return res.status(404).end();
  try{const sample=(await samples())[req.params.kind];res.set('Cache-Control','private, no-store');res.set('Content-Disposition',`attachment; filename="${sample.number}.pdf"`);res.type('application/pdf').send(sample.pdf);}catch{res.status(500).json({code:'TEST_DOCUMENT_UNAVAILABLE'});}
 });
}
