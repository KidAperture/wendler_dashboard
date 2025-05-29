"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, User, BarChart3, Settings, Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { AppLogo } from "./AppLogo"
import { APP_NAME } from "@/lib/constants"


const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  // { href: "/settings", label: "Settings", icon: Settings }, // Optional
]

export function AppSidebar() {
  const pathname = usePathname()
  const { open, setOpen, isMobile, openMobile, setOpenMobile } = useSidebar()

  const commonLinkProps = (isMobileProp: boolean) => isMobileProp ? { onClick: () => setOpenMobile(false) } : { onClick: () => {
      // if sidebar is collapsible icon type and is collapsed, don't setOpen(true)
      // this is a bit of a hack to prevent the sidebar from expanding when clicking on an icon
      if (open === false && !isMobile) { 
        // Allow it to expand if it's not in icon-only mode. This is a rough check.
        // A better approach might involve checking the 'collapsible' prop of Sidebar if accessible here.
        const sidebarElement = document.querySelector('[data-sidebar="sidebar"]');
        if(sidebarElement && sidebarElement.getAttribute('data-collapsible') === 'icon'){
          return;
        }
      }
      setOpen(true);
    }
  }

  return (
    <Sidebar
      variant="sidebar" // "sidebar", "floating", "inset"
      collapsible="icon" // "offcanvas", "icon", "none"
      className="border-r bg-sidebar text-sidebar-foreground"
    >
      <SidebarHeader className="p-2 h-[60px] flex items-center">
        <Link href="/dashboard" className="flex items-center gap-2" {...commonLinkProps(isMobile)}>
            <Dumbbell className={cn("h-8 w-8 text-sidebar-primary", (open || isMobile) && "mr-2")} />
            <span className={cn("font-semibold text-lg whitespace-nowrap", (!open && !isMobile) && "sr-only")}>{APP_NAME}</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                  tooltip={{children: item.label, className: "ml-2"}}
                  {...commonLinkProps(isMobile)}
                >
                  <a>
                    <item.icon />
                    <span>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        {/* Can add user avatar or settings shortcut here */}
      </SidebarFooter>
    </Sidebar>
  )
}
