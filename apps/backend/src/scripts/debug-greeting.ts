import { PLATFORM_MODULE } from "../modules/platform"
import { getCommerceGateway } from "../modules/call-center/gateway"

export default async function ({ container }: { container: any }) {
  try {
    const platform: any = container.resolve(PLATFORM_MODULE)
    const tenant = await platform.retrieveTenant("ten_01KX1C5HT67VS85MGEVT4A6HQB")
    console.log("TENANT_NAME:", JSON.stringify(tenant?.name))
  } catch (e: any) {
    console.log("TENANT_ERR:", e?.message)
  }
  try {
    const gateway = getCommerceGateway(container)
    const orders = await gateway.findOrders("ten_01KX1C5HT67VS85MGEVT4A6HQB", { phone: "+61400111222" } as any)
    console.log("ORDERS:", (orders ?? []).length, JSON.stringify((orders ?? [])[0] ?? null)?.slice(0, 300))
  } catch (e: any) {
    console.log("ORDERS_ERR:", e?.message)
  }
}
