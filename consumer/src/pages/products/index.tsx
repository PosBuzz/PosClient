import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Card,
  Col,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { productApi } from "../../api/product-api";
import PageTitle from "../../components/PageTitle";
import { Permissions } from "../../constants/permissions";
import { queryKeys, queryStaleTimeMap } from "../../constants/queryKeys";
import { useAuthStore } from "../../stores/authStore";
import { useMessageStore } from "../../stores/messageStore";
import type {
  Product,
  ProductListFilters,
  ProductListResponse,
} from "../../types/product.types";
import { cacheInvalidation } from "../../utils/cacheInvalidation";
import { setPageTitle } from "../../utils/setPageTitle";

const { Option } = Select;
const { Text } = Typography;

const ProductsTable = () => {
  const { user } = useAuthStore();

  const hasPermission = (permission: string) => {
    return user?.permissions?.includes(permission);
  };

  const { messageApi } = useMessageStore();
  // Input state (tracks what the user is typing)
  const [searchText, setSearchText] = useState("");
  // Debounced state (used for actual API calls)
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  const [categoryFilter, setCategoryFilter] = useState<number[]>([]);
  const [brandFilter, setBrandFilter] = useState<number[]>([]);
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Debounce function to delay API calls
  const debouncedSearch = useCallback(
    debounce((nextValue: string) => setDebouncedSearchText(nextValue), 500),
    []
  );

  // Effect to trigger debounced search when searchText changes
  useEffect(() => {
    debouncedSearch(searchText);
    return () => {
      debouncedSearch.cancel(); // Cleanup on unmount
    };
  }, [searchText, debouncedSearch]);

  // Reset pagination when filters change
  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [debouncedSearchText, categoryFilter, brandFilter, tagFilter]);

  // Build query parameters for product list
  const getQueryParams = (): ProductListFilters => {
    const params: ProductListFilters = {
      page: pagination.current,
      limit: pagination.pageSize,
    };

    if (debouncedSearchText) params.search = debouncedSearchText;

    // Handle multiple categories
    if (categoryFilter && categoryFilter.length > 0) {
      params.categoryIds = categoryFilter;
    }

    // Handle multiple brands
    if (brandFilter && brandFilter.length > 0) {
      params.brandIds = brandFilter;
    }

    // Handle multiple tags
    if (tagFilter && tagFilter.length > 0) {
      params.tagIds = tagFilter;
    }

    return params;
  };

  // Handle category filter change
  const handleCategoryChange = (values: number[]) => {
    setCategoryFilter(values || []);
  };

  // Handle brand filter change
  const handleBrandChange = (values: number[]) => {
    setBrandFilter(values || []);
  };

  // Handle tag filter change
  const handleTagChange = (values: number[]) => {
    setTagFilter(values || []);
  };

  // Handle search input change (this updates the input value instantly, but API call is debounced)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  // Handle search clear
  const handleSearchClear = () => {
    setSearchText("");
    setDebouncedSearchText("");
  };

  // Clear all filters
  const handleClearAllFilters = () => {
    setSearchText("");
    setDebouncedSearchText("");
    setCategoryFilter([]);
    setBrandFilter([]);
    setTagFilter([]);
  };

  // TanStack Query for products
  const { data: productsData, isLoading: productsLoading } =
    useQuery<ProductListResponse>({
      queryKey: [queryKeys.products, getQueryParams()],
      queryFn: () => productApi.getProducts(getQueryParams()),
      staleTime: queryStaleTimeMap[queryKeys.products],
    });

  // TanStack Query for categories
  const { data: categories = [] } = useQuery({
    queryKey: [queryKeys.categories],
    queryFn: productApi.getCategories,
    staleTime: queryStaleTimeMap[queryKeys.categories],
  });

  // TanStack Query for brands
  const { data: brands = [] } = useQuery({
    queryKey: [queryKeys.brands],
    queryFn: productApi.getBrands,
    staleTime: queryStaleTimeMap[queryKeys.brands],
  });

  // TanStack Query for tags
  const { data: tags = [] } = useQuery({
    queryKey: [queryKeys.tags],
    queryFn: productApi.getTags,
    staleTime: queryStaleTimeMap[queryKeys.tags],
  });

  // Delete mutation
  const deleteProductMutation = useMutation({
    mutationFn: productApi.deleteProduct,
    onSuccess: () => {
      messageApi?.success("Product deleted successfully");
      // Invalidate all relevant caches after product operation
      cacheInvalidation.invalidateAfterProductOperation(queryClient);
    },
    onError: (error) => {
      messageApi?.error("Failed to delete product");
      console.error(error);
    },
  });

  // Handle table change (pagination)
  const handleTableChange = (
    paginationData: any,
    filters: any,
    sorter: any
  ) => {
    setPagination({
      current: paginationData.current,
      pageSize: paginationData.pageSize,
    });
    // The query will automatically refetch when pagination state changes
  };

  // Handle product deletion
  const handleDelete = (id: number) => {
    deleteProductMutation.mutate(id);
  };

  // Navigate to edit page
  const handleEdit = (id: number) => {
    navigate(`/products/edit/${id}`);
  };

  // Navigate to view page
  const handleView = (id: number) => {
    navigate(`/products/view/${id}`);
  };

  // Helper function to get main variant (default or first)
  const getMainVariant = (product: Product) => {
    return product.variants?.find((v) => v.is_default) || product.variants?.[0];
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return (
      debouncedSearchText ||
      categoryFilter.length > 0 ||
      brandFilter.length > 0 ||
      tagFilter.length > 0
    );
  };

  // Table columns
  const columns = [
    {
      title: "Product",
      key: "product",
      width: "35%",
      render: (_, record: Product) => {
        const mainVariant = getMainVariant(record);
        return (
          <Space>
            <Avatar
              src={mainVariant?.image}
              icon={<SettingOutlined />}
              size={48}
              shape="square"
            />
            <div>
              <div>
                <Text strong style={{ fontSize: "14px" }}>
                  {record.name}
                </Text>
              </div>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Code: {record.code || "No code"}
              </Text>
              {record.description && (
                <div>
                  <Text type="secondary" style={{ fontSize: "11px" }}>
                    {record.description.length > 60
                      ? `${record.description.substring(0, 60)}...`
                      : record.description}
                  </Text>
                </div>
              )}
              {/* Display product tags */}
              {record.tags && record.tags.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {record.tags.slice(0, 3).map((tagItem) => (
                    <Tag
                      key={tagItem.tag.id}
                      color="blue"
                      style={{ fontSize: "10px", marginRight: 4 }}
                    >
                      {tagItem.tag.name}
                    </Tag>
                  ))}
                  {record.tags.length > 3 && (
                    <Tag color="default" style={{ fontSize: "10px" }}>
                      +{record.tags.length - 3}
                    </Tag>
                  )}
                </div>
              )}
            </div>
          </Space>
        );
      },
    },
    {
      title: "Category",
      dataIndex: ["category", "name"],
      key: "category",
      width: "12%",
      render: (name: string) =>
        name || <Text type="secondary">No category</Text>,
    },
    {
      title: "Brand",
      dataIndex: ["brand", "name"],
      key: "brand",
      width: "12%",
      render: (name: string) => name || <Text type="secondary">No brand</Text>,
    },
    {
      title: "Tax",
      key: "tax",
      width: "8%",
      align: "center" as const,
      render: (_, record: Product) => {
        const taxMethod = record.tax_method || "exclusive";
        const taxValue = record.tax || 0;

        return (
          <div style={{ textAlign: "center" }}>
            <Text strong>{taxValue}%</Text>
            <div>
              <Text
                type="secondary"
                style={{ fontSize: "10px", textTransform: "capitalize" }}
              >
                {taxMethod}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: "Created",
      key: "created_at",
      width: "10%",
      render: (_, record: Product) => {
        const date = new Date(record.created_at);
        return (
          <div>
            <Text style={{ fontSize: "12px" }}>
              {date.toLocaleDateString()}
            </Text>
            <div>
              <Text type="secondary" style={{ fontSize: "10px" }}>
                {date.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: "11%",
      render: (_, record: Product) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleView(record.id)}
              size="small"
            />
          </Tooltip>
          {hasPermission(Permissions.edit_product) && (
            <Tooltip title="Edit Product">
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record.id)}
                size="small"
              />
            </Tooltip>
          )}
          {hasPermission(Permissions.delete_product) && (
            <Popconfirm
              title="Delete Product"
              description="Are you sure you want to delete this product? This action cannot be undone."
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
              placement="topRight"
            >
              <Tooltip title="Delete Product">
                <Button
                  type="primary"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  loading={
                    deleteProductMutation.isPending &&
                    deleteProductMutation.variables === record.id
                  }
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const title = "Products";

  return (
    <>
      {setPageTitle(title)}
      <PageTitle
        title={title}
        breadcrumbs={[
          {
            title: "Dashboard",
            href: "/",
          },
          {
            title: title,
          },
        ]}
        rightSection={
          hasPermission(Permissions.add_product) && (
            <Link to={"/products/add"}>
              <Button icon={<PlusOutlined />} type="primary">
                Add Product
              </Button>
            </Link>
          )
        }
      />
      <Card>
        {/* Filter and Search Section */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder="Search products..."
              value={searchText}
              onChange={handleSearchChange}
              prefix={<SearchOutlined />}
              allowClear
              onClear={handleSearchClear}
            />
          </Col>

          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              mode="multiple"
              placeholder="Select Categories"
              value={categoryFilter}
              onChange={handleCategoryChange}
              style={{ width: "100%" }}
              allowClear
              maxTagCount="responsive"
              loading={productsLoading}
            >
              {categories.map((category: any) => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              mode="multiple"
              placeholder="Select Brands"
              value={brandFilter}
              onChange={handleBrandChange}
              style={{ width: "100%" }}
              allowClear
              maxTagCount="responsive"
              loading={productsLoading}
            >
              {brands.map((brand: any) => (
                <Option key={brand.id} value={brand.id}>
                  {brand.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              mode="multiple"
              placeholder="Select Tags"
              value={tagFilter}
              onChange={handleTagChange}
              style={{ width: "100%" }}
              allowClear
              maxTagCount="responsive"
              loading={productsLoading}
            >
              {tags.map((tag: any) => (
                <Option key={tag.id} value={tag.id}>
                  <TagOutlined style={{ marginRight: 4 }} />
                  {tag.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={4} lg={3}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {productsData?.meta?.total || 0} products found
              </Text>
              {hasActiveFilters() && (
                <Button
                  type="link"
                  size="small"
                  onClick={handleClearAllFilters}
                  style={{ padding: 0, height: "auto", fontSize: "11px" }}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          </Col>
        </Row>

        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <Row style={{ marginBottom: 16 }}>
            <Col span={24}>
              <Space wrap>
                <Text type="secondary" style={{ fontSize: "12px" }}>
                  Active filters:
                </Text>

                {debouncedSearchText && (
                  <Tag closable onClose={() => handleSearchClear()}>
                    Search: "{debouncedSearchText}"
                  </Tag>
                )}

                {categoryFilter.map((categoryId) => {
                  const category = categories.find(
                    (c: any) => c.id === categoryId
                  );
                  return category ? (
                    <Tag
                      key={categoryId}
                      closable
                      onClose={() =>
                        setCategoryFilter((prev) =>
                          prev.filter((id) => id !== categoryId)
                        )
                      }
                    >
                      Category: {category.name}
                    </Tag>
                  ) : null;
                })}

                {brandFilter.map((brandId) => {
                  const brand = brands.find((b: any) => b.id === brandId);
                  return brand ? (
                    <Tag
                      key={brandId}
                      closable
                      onClose={() =>
                        setBrandFilter((prev) =>
                          prev.filter((id) => id !== brandId)
                        )
                      }
                    >
                      Brand: {brand.name}
                    </Tag>
                  ) : null;
                })}

                {tagFilter.map((tagId) => {
                  const tag = tags.find((t: any) => t.id === tagId);
                  return tag ? (
                    <Tag
                      key={tagId}
                      closable
                      color="blue"
                      onClose={() =>
                        setTagFilter((prev) =>
                          prev.filter((id) => id !== tagId)
                        )
                      }
                    >
                      <TagOutlined /> {tag.name}
                    </Tag>
                  ) : null;
                })}
              </Space>
            </Col>
          </Row>
        )}

        {/* Products Table */}
        <Table
          columns={columns}
          dataSource={productsData?.data || []}
          rowKey="id"
          loading={productsLoading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: productsData?.meta?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} products`,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
          size="middle"
        />
      </Card>
    </>
  );
};

export default ProductsTable;
