"use client";
import{useEffect,useState}from"react";

type Job={id:string;serverId:string;status:string;goal:string;steps:Array<{id:string;tool:string;status:string}>;answer?:string};
type State={agents:Array<{serverId:string;lastSeen:string}>;jobs:Job[];pending:Job[];status:Record<string,{state:string;minecraftVersion?:string;players:number;tps?:number;mspt?:number;diskFreeBytes?:number}>;console:Record<string,string[]>};

const empty:State={agents:[],jobs:[],pending:[],status:{},console:{}};
const nav=["Overview","AI Operator","Console","Plugins","Files","Worlds","Players","Backups","Monitoring","Audit Log","Settings"];

export default function Dashboard(){
 const[input,setInput]=useState("");const[state,setState]=useState<State>(empty);const[loading,setLoading]=useState(false);const[error,setError]=useState("");
 const refresh=async()=>{try{const r=await fetch("/api/control",{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error??"Control plane unavailable");setState(d);setError("");}catch(e){setError(e instanceof Error?e.message:String(e));}};
 useEffect(()=>{refresh();const id=setInterval(refresh,1000);return()=>clearInterval(id)},[]);
 const send=async()=>{const goal=input.trim();if(!goal||loading)return;setLoading(true);setInput("");setError("");try{const r=await fetch("/api/control",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"job",goal})});const d=await r.json();if(!r.ok)throw new Error(d.error??"Could not create job");await refresh();}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}};
 const approve=async(jobId:string)=>{setError("");try{const r=await fetch("/api/control",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"approve",jobId})});const d=await r.json();if(!r.ok)throw new Error(d.error??"Approval failed");await refresh();}catch(e){setError(e instanceof Error?e.message:String(e));}};
 const sid=process.env.NEXT_PUBLIC_SERVER_ID??"minecraft-server";const status=state.status[sid];const connected=state.agents.some(a=>a.serverId===sid);
 return <main style={{minHeight:"100vh",display:"grid",gridTemplateColumns:"230px 1fr",background:"#08090b"}}>
  <aside style={{borderRight:"1px solid #202228",padding:24}}><h1 style={{margin:0,letterSpacing:2}}>YAZONI</h1><p style={{color:"#8b919d",marginTop:4}}>SERVER AI</p>{nav.map((x,i)=><div key={x} style={{padding:"10px 4px",color:i===1?"#fff":"#8b919d",fontWeight:i===1?700:400}}>{x}</div>)}</aside>
  <section style={{display:"flex",flexDirection:"column",minWidth:0}}>
   <header style={{padding:"20px 28px",borderBottom:"1px solid #202228",display:"flex",justifyContent:"space-between",alignItems:"center"}}><strong>AI Operator</strong><span style={{color:connected?"#7dd3a5":"#e5b65c"}}>● {connected?"Agent connected":"Agent not connected"}</span></header>
   <div style={{padding:28,maxWidth:1100,width:"100%",boxSizing:"border-box",margin:"0 auto"}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
     {[["State",status?.state??"unknown"],["Version",status?.minecraftVersion??"—"],["Players",String(status?.players??0)],["Jobs",String(state.jobs.length)]].map(([k,v])=><div key={k} style={{padding:16,border:"1px solid #202228",background:"#111318",borderRadius:12}}><div style={{fontSize:12,color:"#777d88"}}>{k}</div><strong style={{display:"block",marginTop:6}}>{v}</strong></div>)}
    </div>
    {error&&<div style={{padding:12,marginBottom:14,border:"1px solid #713f3f",background:"#241416",borderRadius:10,color:"#ffb4b4"}}>{error}</div>}
    {state.pending.map(job=><div key={job.id} style={{padding:18,marginBottom:14,border:"1px solid #8b6d36",background:"#17130b",borderRadius:12}}>
      <div style={{fontWeight:700}}>Approval required</div><div style={{color:"#c9c3b4",margin:"8px 0"}}>{job.goal}</div>
      <div style={{fontSize:13,color:"#a8a090"}}>{job.steps.filter(s=>s.status==="waiting_approval").map(s=>s.tool).join(", ")||"A risky operation is waiting."}</div>
      <button onClick={()=>approve(job.id)} style={{marginTop:12,padding:"10px 16px",border:0,borderRadius:8,cursor:"pointer"}}>Approve & continue</button>
    </div>)}
    <div style={{display:"grid",gridTemplateColumns:"1.3fr .7fr",gap:16}}>
     <div><h2 style={{marginTop:0}}>AI Operator</h2><p style={{color:"#8b919d"}}>Describe the outcome. The agent inspects the server, calls registered tools, pauses risky changes for approval, then verifies the result.</p>
      {state.jobs.slice(-8).map(job=><div key={job.id} style={{marginTop:10,padding:15,background:"#111318",border:"1px solid #202228",borderRadius:12}}><div style={{display:"flex",justifyContent:"space-between"}}><span>{job.goal}</span><span style={{color:"#8b919d",fontSize:12}}>{job.status}</span></div>{job.answer&&<div style={{marginTop:8,color:"#aeb3bd",fontSize:13}}>{job.answer}</div>}<div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>{job.steps.map(s=><span key={s.id} style={{fontSize:11,padding:"4px 7px",border:"1px solid #2a2e36",borderRadius:6,color:"#aeb3bd"}}>{s.tool} · {s.status}</span>)}</div></div>)}
     </div>
     <div><h3 style={{marginTop:0}}>Live console</h3><pre style={{height:430,overflow:"auto",background:"#050607",border:"1px solid #202228",borderRadius:12,padding:14,fontSize:11,color:"#b7bbc4",whiteSpace:"pre-wrap"}}>{(state.console[sid]??[]).slice(-120).join("\n")||"Waiting for agent output…"}</pre></div>
    </div>
   </div>
   <div style={{padding:20,borderTop:"1px solid #202228"}}><div style={{display:"flex",gap:10,maxWidth:1100,margin:"0 auto"}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}} placeholder="e.g. Turn this into a prison server and verify everything works…" style={{flex:1,padding:14,borderRadius:10,border:"1px solid #30343d",background:"#111318",color:"#fff"}}/><button disabled={loading} onClick={send} style={{padding:"0 22px",border:0,borderRadius:10,cursor:"pointer"}}>{loading?"Sending…":"Send"}</button></div></div>
  </section>
 </main>;
}