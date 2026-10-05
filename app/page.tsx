"use client";
import {useState} from "react";
type Result={id:string;name:string;description:string;icon?:string;downloads?:number;version?:string;source:"Modrinth"|"Spigot"};
export default function Home(){
 const[q,setQ]=useState("");const[source,setSource]=useState<"modrinth"|"spigot">("modrinth");const[results,setResults]=useState<Result[]>([]);const[loading,setLoading]=useState(false);const[message,setMessage]=useState("");const[password,setPassword]=useState("");
 async function search(){if(q.trim().length<2)return;setLoading(true);setMessage("");try{const r=await fetch("/api/search?q="+encodeURIComponent(q)+"&source="+source);const d=await r.json();if(!r.ok)throw new Error(d.error);setResults(d.results??[])}catch(e){setMessage(e instanceof Error?e.message:"Search failed")}finally{setLoading(false)}}
 async function install(x:Result){setMessage("Installing "+x.name+" directly to the server…");try{const r=await fetch("/api/install",{method:"POST",headers:{"content-type":"application/json","x-admin-password":password},body:JSON.stringify({source:x.source,id:x.id})});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage("✓ Installed "+d.filename+" directly into /plugins.")}catch(e){setMessage(e instanceof Error?e.message:"Install failed")}}
 return <main className="wrap">
  <header className="top"><div><div className="brand">YAZONI PLUGIN DOWNLOADER</div><div className="sub">Install directly to your Minecraft server · Modrinth + Spigot</div></div></header>
  <div className="notice">Enter the admin password once, then every Install button sends the plugin straight to your EternalZero server.</div>
  <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Admin password" style={{width:"100%",background:"#111318",border:"1px solid #292d35",color:"white",borderRadius:10,padding:14,marginBottom:12}}/>
  <div className="search"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")search()}} placeholder="Search for a plugin…"/><button onClick={search} disabled={loading}>{loading?"Searching…":"Search"}</button></div>
  <div className="tabs"><button className={"tab "+(source==="modrinth"?"active":"")} onClick={()=>setSource("modrinth")}>Modrinth</button><button className={"tab "+(source==="spigot"?"active":"")} onClick={()=>setSource("spigot")}>Spigot</button></div>
  {message&&<div className={"notice "+(message.startsWith("✓")?"success":"")}>{message}</div>}
  <section className="grid">{results.map(x=><article className="card" key={x.source+"-"+x.id}><div className="row">{x.icon&&<img className="icon" src={x.icon} alt=""/>}<div><div className="title">{x.name}</div><div className="muted">{x.source}{x.version?" · "+x.version:""}</div></div></div><p className="desc">{x.description||"No description available."}</p><div className="meta"><span className="muted">{x.downloads?.toLocaleString()??"—"} downloads</span><button className="install" onClick={()=>install(x)}>Install</button></div></article>)}</section>
 </main>
}