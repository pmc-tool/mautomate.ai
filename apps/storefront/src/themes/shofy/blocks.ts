/* Shofy theme — block map. Every visual block has a bespoke Shofy renderer
 * built from the Shofy template markup; `container` is theme-neutral and
 * shared across themes. */
import type { ThemeBlockMap } from "../contract"
import Container from "@modules/cms/blocks/Container"
import ImageGallery from "@modules/cms/blocks/ImageGallery"
import HeroSlider from "./blocks/HeroSlider"
import PromoBannerGrid from "./blocks/PromoBannerGrid"
import ProductTabs from "./blocks/ProductTabs"
import DealOfDay from "./blocks/DealOfDay"
import CategoryShowcase from "./blocks/CategoryShowcase"
import BrandStrip from "./blocks/BrandStrip"
import RichText from "./blocks/RichText"
import ImageWithText from "./blocks/ImageWithText"
import Newsletter from "./blocks/Newsletter"
import InstagramGrid from "./blocks/InstagramGrid"
import Testimonials from "./blocks/Testimonials"

export const shofyBlocks: ThemeBlockMap = {
  hero_slider: HeroSlider,
  promo_banner_grid: PromoBannerGrid,
  product_tabs: ProductTabs,
  deal_of_day: DealOfDay,
  category_showcase: CategoryShowcase,
  brand_strip: BrandStrip,
  rich_text: RichText,
  image_with_text: ImageWithText,
  newsletter: Newsletter,
  instagram_grid: InstagramGrid,
  testimonials: Testimonials,
  image_gallery: ImageGallery,
  container: Container,
}
