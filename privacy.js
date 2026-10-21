/* Authorization is memory-only and tied to a popup port, never a saved site preference. */
(function(root){
 function create(onRevoke=async()=>{}){
  const sessions=new Map();
  async function open(tabId){const old=sessions.get(tabId);if(old)await close(old);const lease={tabId,id:crypto.randomUUID(),token:null,allowed:false,auto:false,submit:false,origin:null,history:[],flow:{phase:'ready',message:'Ready to start.'},reference:'',lookup:false};sessions.set(tabId,lease);return lease;}
  function current(lease){return !!lease&&sessions.get(lease.tabId)===lease;}
  function requireAccess(tabId,token){const lease=sessions.get(tabId);if(!lease?.allowed||!lease.token||(token!==undefined&&token!==lease.token))throw Error('Reading is locked. Open the extension and click Allow read.');return lease;}
  function allow(lease){if(!current(lease))throw Error('This popup session has ended.');lease.allowed=true;lease.token=crypto.randomUUID();return lease.token;}
  async function close(lease){if(!current(lease))return;lease.allowed=false;lease.auto=false;lease.submit=false;lease.lookup=false;lease.reference='';lease.history=[];sessions.delete(lease.tabId);await onRevoke(lease);lease.token=null;}
  return {open,allow,close,current,requireAccess,get:tabId=>sessions.get(tabId)};
 }
 const api={create};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ReadSessions=api;
})(globalThis);
