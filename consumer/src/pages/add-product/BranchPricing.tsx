import { Form, InputNumber, Select, Button, Alert } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "../../api/product-api";
import { useEffect } from "react";

export default function BranchPricing() {
  const parentForm = Form.useFormInstance(); // Get the parent form instance
  
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: productApi.getBranches,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Initialize any needed state from parent form
  useEffect(() => {
    // This ensures the component registers with the form on mount
  }, [parentForm]);

  return (
    <div className="space-y-4">
      <Alert 
        message="Branch-specific pricing" 
        description="Set different prices for each branch. Leave empty to use the default product price."
        type="info" 
        showIcon 
        className="mb-4"
      />
      
      <Form.List name="branch_prices">
        {(fields, { add, remove }) => (
          <>
            {fields.map(({ key, name, ...restField }) => (
              <div key={key} className="flex items-center space-x-4 mb-2">
                <Form.Item
                  {...restField}
                  name={[name, "branch_id"]}
                  rules={[{ required: true, message: "Please select branch" }]}
                  className="w-48 mb-0"
                  preserve={true}
                >
                  <Select 
                    placeholder="Select Branch" 
                    loading={isLoading}
                    className="w-full"
                    showSearch
                    optionFilterProp="children"
                  >
                    {branches?.map((branch) => (
                      <Select.Option key={branch.id} value={branch.id}>
                        {branch.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item
                  {...restField}
                  name={[name, "price"]}
                  rules={[{ required: true, message: "Please enter price" }]}
                  className="flex-1 mb-0"
                  preserve={true}
                >
                  <InputNumber 
                    min={0} 
                    placeholder="Branch-specific price" 
                    className="w-full" 
                    formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                  />
                </Form.Item>
                
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={() => remove(name)}
                />
              </div>
            ))}
            
            <Button 
              type="dashed" 
              onClick={() => add()} 
              className="w-full"
              icon={<span className="mr-2">+</span>}
            >
              Add Branch Price
            </Button>
          </>
        )}
      </Form.List>
    </div>
  );
}
