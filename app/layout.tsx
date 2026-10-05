import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"Yazoni Plugin Downloader",description:"Install Minecraft plugins directly to your server."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
