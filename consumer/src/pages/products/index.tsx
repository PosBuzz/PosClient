import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
} from "antd";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { productApi } from "../../api/product-api";
import PageTitle from "../../components/PageTitle";
import { useMessageStore } from "../../stores/messageStore";
import { useAuthStore } from "../../stores/authStore";
import { Permissions } from "../../constants/permissions";

const { Option } = Select;

const ProductsTable = () => {
  const { user } = useAuthStore();

  const hasPermission = (permission) => {
    return user?.permissions?.includes(permission);
  };

  const { messageApi } = useMessageStore();
  // Input state (tracks what the user is typing)
  const [searchText, setSearchText] = useState("");
  // Debounced state (used for actual API calls)
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  const [categoryFilter, setCategoryFilter] = useState(null);
  const [brandFilter, setBrandFilter] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Debounce function to delay API calls
  const debouncedSearch = useCallback(
    debounce((nextValue) => setDebouncedSearchText(nextValue), 500),
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
  }, [debouncedSearchText, categoryFilter, brandFilter]);

  // Build query parameters for product list
  const getQueryParams = () => {
    const params: Record<string, any> = {
      page: pagination.current,
      limit: pagination.pageSize,
    };

    if (debouncedSearchText) params.search = debouncedSearchText;
    if (categoryFilter) params.category_id = parseInt(categoryFilter);
    if (brandFilter) params.brand_id = parseInt(brandFilter);

    return params;
  };

  // Handle category filter change immediately
  const handleCategoryChange = (value) => {
    setCategoryFilter(value);
  };

  // Handle brand filter change immediately
  const handleBrandChange = (value) => {
    setBrandFilter(value);
  };

  // Handle search input change (this updates the input value instantly, but API call is debounced)
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // Handle search clear
  const handleSearchClear = () => {
    setSearchText("");
    setDebouncedSearchText("");
  };

  // TanStack Query for products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", getQueryParams()],
    queryFn: () => productApi.getProducts(getQueryParams()),
  });

  // TanStack Query for categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: productApi.getCategories,
  });

  // TanStack Query for brands
  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: productApi.getBrands,
  });

  // Delete mutation
  const deleteProductMutation = useMutation({
    mutationFn: productApi.deleteProduct,
    onSuccess: () => {
      messageApi?.success("Product deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error) => {
      messageApi?.error("Failed to delete product");
      console.error(error);
    },
  });

  // Handle table change (pagination)
  const handleTableChange = (paginationData, filters, sorter) => {
    setPagination({
      current: paginationData.current,
      pageSize: paginationData.pageSize,
    });
    // The query will automatically refetch when pagination state changes
  };

  // Handle product deletion
  const handleDelete = (id) => {
    deleteProductMutation.mutate(id);
  };

  // Navigate to edit page
  const handleEdit = (id) => {
    navigate(`/products/edit/${id}`);
  };

  // Navigate to view page
  const handleView = (id) => {
    navigate(`/products/view/${id}`);
  };

  // Table columns
  const columns = [
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      width: "12%",
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: "20%",
    },
    {
      title: "Category",
      dataIndex: ["category", "name"],
      key: "category",
      width: "15%",
    },
    {
      title: "Brand",
      dataIndex: ["brand", "name"],
      key: "brand",
      width: "15%",
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      width: "12%",
      render: (price) => `$${price.toFixed(2)}`,
    },
    {
      title: "In Stock",
      dataIndex: "in_stock",
      key: "in_stock",
      width: "10%",
      render: (inStock) => (
        <Tag color={inStock ? "green" : "red"}>{inStock ? "Yes" : "No"}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: "16%",
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleView(record.id)}
          />
          {hasPermission(Permissions.edit_product) && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record.id)}
              size="small"
            />
          )}
          {hasPermission(Permissions.delete_product) && (
            <Popconfirm
              title="Are you sure you want to delete this product?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
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
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const title = "Products";

  return (
    <>
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
                Add Products
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
              placeholder="All Categories"
              value={categoryFilter}
              onChange={handleCategoryChange}
              style={{ width: "100%" }}
              allowClear
              loading={productsLoading}
            >
              {categories.map((category) => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6} lg={5}>
            <Select
              placeholder="All Brands"
              value={brandFilter}
              onChange={handleBrandChange}
              style={{ width: "100%" }}
              allowClear
              loading={productsLoading}
            >
              {brands.map((brand) => (
                <Option key={brand.id} value={brand.id}>
                  {brand.name}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>

        {/* Products Table */}
        <Table
          columns={columns}
          dataSource={productsData?.data || []}
          rowKey="id"
          loading={productsLoading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: productsData?.meta.total || 0,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
          }}
          onChange={handleTableChange}
          scroll={{ x: "max-content" }}
        />
      </Card>
    </>
  );
};

export default ProductsTable;
