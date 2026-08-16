import { Tabs, Tag, Typography } from "antd";
import { endpoints } from "../../api/endpoints";
import PageTitle from "../../components/PageTitle";
import { setPageTitle } from "../../utils/setPageTitle";
import CollectionEditor, { FieldDef } from "./_CollectionEditor";
import Leads from "./_Leads";
import SettingsForm from "./_SettingsForm";

const { Text } = Typography;

const title = "Portfolio Site";

const listHelp = "Press Enter after each entry.";

const solutionFields: FieldDef[] = [
  { name: "slug", label: "Slug", type: "text", required: true, help: "Stable id, e.g. retail-apparel" },
  { name: "title", label: "Title", type: "text", required: true },
  { name: "subtitle", label: "Subtitle", type: "text", required: true },
  { name: "icon_name", label: "Icon", type: "text", required: true, help: "lucide-react icon name, e.g. ShoppingBag" },
  { name: "badge", label: "Badge", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea", required: true, rows: 4 },
  { name: "features", label: "Features", type: "list", help: listHelp },
  { name: "benefits", label: "Benefits", type: "list", help: listHelp },
  { name: "metric_label", label: "Metric label", type: "text", required: true },
  { name: "metric_value", label: "Metric value", type: "text", required: true },
  { name: "image_key", label: "Image key", type: "text", required: true },
];

const featureFields: FieldDef[] = [
  { name: "slug", label: "Slug", type: "text", required: true },
  { name: "category", label: "Category", type: "text", required: true, help: "pos, inventory, multi-branch, loyalty, quotation-orders, hardware" },
  { name: "title", label: "Title", type: "text", required: true },
  { name: "tagline", label: "Tagline", type: "text", required: true },
  { name: "description", label: "Description", type: "textarea", required: true, rows: 4 },
  { name: "highlights", label: "Highlights", type: "list", help: listHelp },
  { name: "icon", label: "Icon", type: "text", required: true, help: "lucide-react icon name, e.g. Zap" },
  { name: "badge", label: "Badge", type: "text" },
];

const pricingFields: FieldDef[] = [
  { name: "slug", label: "Slug", type: "text", required: true },
  { name: "name", label: "Plan name", type: "text", required: true },
  { name: "badge", label: "Badge", type: "text" },
  { name: "description", label: "Description", type: "textarea", required: true, rows: 3 },
  { name: "price_monthly", label: "Monthly price", type: "number", required: true, precision: 2 },
  { name: "price_annual_monthly", label: "Annual price (per month)", type: "number", required: true, precision: 2 },
  { name: "is_popular", label: "Highlight as most popular", type: "switch" },
  { name: "features", label: "Included features", type: "list", help: listHelp },
  { name: "not_included", label: "Not included", type: "list", help: listHelp },
  { name: "cta", label: "Call to action", type: "text", required: true },
];

const faqFields: FieldDef[] = [
  { name: "question", label: "Question", type: "textarea", required: true, rows: 2 },
  { name: "answer", label: "Answer", type: "textarea", required: true, rows: 6 },
  { name: "aeo_summary", label: "AEO summary", type: "textarea", required: true, rows: 3, help: "One-sentence answer used for AI/answer-engine snippets and FAQ schema." },
  { name: "category", label: "Category", type: "text", required: true },
];

const testimonialFields: FieldDef[] = [
  { name: "quote", label: "Quote", type: "textarea", required: true, rows: 4 },
  { name: "author", label: "Author", type: "text", required: true },
  { name: "role", label: "Role", type: "text", required: true },
  { name: "company", label: "Company", type: "text", required: true },
  { name: "rating", label: "Rating (1-5)", type: "number", required: true },
  { name: "metrics", label: "Metric badge", type: "text" },
];

const demoProductFields: FieldDef[] = [
  { name: "name", label: "Product name", type: "text", required: true },
  { name: "sku", label: "SKU", type: "text", required: true },
  { name: "price", label: "Retail price", type: "number", required: true, precision: 2 },
  { name: "wholesale_price", label: "Wholesale price", type: "number", required: true, precision: 2 },
  { name: "category", label: "Category", type: "text", required: true },
  { name: "image", label: "Emoji", type: "text", required: true, help: "Shown as the product tile in the live POS simulator." },
  { name: "tax", label: "Tax rate", type: "number", required: true, step: 0.01, precision: 4, help: "Fraction, e.g. 0.05 for 5%." },
  { name: "serial", label: "Serial / batch", type: "text" },
];

const money = (value: string | number) => `$${Number(value).toFixed(2)}`;

const Portfolio = () => (
  <>
    {setPageTitle(title)}
    <PageTitle
      title={title}
      breadcrumbs={[{ title: "Dashboard", href: "/" }, { title }]}
    />

    <Tabs
      destroyInactiveTabPane
      items={[
        {
          key: "leads",
          label: "Leads",
          children: <Leads />,
        },
        {
          key: "settings",
          label: "Site Settings",
          children: <SettingsForm />,
        },
        {
          key: "pricing",
          label: "Pricing Plans",
          children: (
            <CollectionEditor
              itemLabel="Plan"
              endpoint={endpoints.portfolioPricingPlans}
              queryKey="portfolio-pricing-plans"
              fields={pricingFields}
              columns={[
                { title: "Plan", dataIndex: "name" },
                { title: "Slug", dataIndex: "slug" },
                {
                  title: "Monthly",
                  dataIndex: "price_monthly",
                  render: money,
                },
                {
                  title: "Annual/mo",
                  dataIndex: "price_annual_monthly",
                  render: money,
                },
                {
                  title: "Popular",
                  dataIndex: "is_popular",
                  render: (value: boolean) =>
                    value ? <Tag color="gold">Featured</Tag> : "—",
                },
              ]}
            />
          ),
        },
        {
          key: "features",
          label: "Features",
          children: (
            <CollectionEditor
              itemLabel="Feature"
              endpoint={endpoints.portfolioFeatures}
              queryKey="portfolio-features"
              fields={featureFields}
              columns={[
                { title: "Title", dataIndex: "title" },
                { title: "Category", dataIndex: "category" },
                {
                  title: "Tagline",
                  dataIndex: "tagline",
                  render: (value: string) => (
                    <Text type="secondary">{value}</Text>
                  ),
                },
              ]}
            />
          ),
        },
        {
          key: "solutions",
          label: "Solutions",
          children: (
            <CollectionEditor
              itemLabel="Solution"
              endpoint={endpoints.portfolioSolutions}
              queryKey="portfolio-solutions"
              fields={solutionFields}
              columns={[
                { title: "Title", dataIndex: "title" },
                { title: "Badge", dataIndex: "badge" },
                {
                  title: "Metric",
                  render: (_: unknown, record: any) =>
                    `${record.metric_value} · ${record.metric_label}`,
                },
              ]}
            />
          ),
        },
        {
          key: "faqs",
          label: "FAQs",
          children: (
            <CollectionEditor
              itemLabel="FAQ"
              endpoint={endpoints.portfolioFaqs}
              queryKey="portfolio-faqs"
              fields={faqFields}
              columns={[
                { title: "Question", dataIndex: "question" },
                { title: "Category", dataIndex: "category" },
              ]}
            />
          ),
        },
        {
          key: "testimonials",
          label: "Testimonials",
          children: (
            <CollectionEditor
              itemLabel="Testimonial"
              endpoint={endpoints.portfolioTestimonials}
              queryKey="portfolio-testimonials"
              fields={testimonialFields}
              columns={[
                { title: "Author", dataIndex: "author" },
                { title: "Company", dataIndex: "company" },
                { title: "Rating", dataIndex: "rating" },
                { title: "Metric", dataIndex: "metrics" },
              ]}
            />
          ),
        },
        {
          key: "demo-products",
          label: "POS Simulator",
          children: (
            <CollectionEditor
              itemLabel="Demo Product"
              endpoint={endpoints.portfolioDemoProducts}
              queryKey="portfolio-demo-products"
              fields={demoProductFields}
              columns={[
                {
                  title: "Product",
                  render: (_: unknown, record: any) =>
                    `${record.image} ${record.name}`,
                },
                { title: "SKU", dataIndex: "sku" },
                { title: "Price", dataIndex: "price", render: money },
                { title: "Category", dataIndex: "category" },
              ]}
            />
          ),
        },
      ]}
    />
  </>
);

export default Portfolio;
