import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Drawer, Form, Input, InputNumber, Switch } from "antd";
import { deliveryPartnersApi } from "../../api/delivery-partners-api";
import { useMessageStore } from "../../stores/messageStore";
import type {
  DeliveryPartner,
  DeliveryPartnerInput,
} from "../../types/delivery-partner.types";
import { getErrorMessage } from "../../utils/api-error";

type Props = {
  open: boolean;
  partner: DeliveryPartner | null;
  onClose: () => void;
};

export default function PartnerDrawer({ open, partner, onClose }: Props) {
  const [form] = Form.useForm<DeliveryPartnerInput>();
  const queryClient = useQueryClient();
  const { messageApi } = useMessageStore();
  const editing = !!partner;

  const save = useMutation({
    mutationFn: (values: DeliveryPartnerInput) =>
      editing
        ? deliveryPartnersApi.update(partner!.id, values)
        : deliveryPartnersApi.create(values),
    onSuccess: () => {
      messageApi?.success(
        editing ? "Delivery partner updated" : "Delivery partner added",
      );
      queryClient.invalidateQueries({ queryKey: ["delivery-partners"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-partner"] });
      onClose();
    },
    onError: (error) =>
      messageApi?.error(getErrorMessage(error, "Failed to save partner")),
  });

  return (
    <Drawer
      title={editing ? "Edit Delivery Partner" : "Add Delivery Partner"}
      open={open}
      onClose={onClose}
      width={Math.min(480, window.innerWidth)}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={
          partner
            ? {
                name: partner.name,
                contact: partner.contact ?? undefined,
                phone: partner.phone ?? undefined,
                notes: partner.notes ?? undefined,
                default_delivery_charge: partner.default_delivery_charge,
                default_cod_fee_percent: partner.default_cod_fee_percent,
                is_active: partner.is_active,
              }
            : {
                default_delivery_charge: 0,
                default_cod_fee_percent: 0,
                is_active: true,
              }
        }
        onFinish={(values) => save.mutate(values)}
      >
        <Form.Item
          label="Partner name"
          name="name"
          rules={[
            { required: true, whitespace: true, message: "Name is required" },
            { max: 200 },
          ]}
        >
          <Input placeholder="e.g. Pathao, Steadfast, RedX" />
        </Form.Item>
        <Form.Item label="Contact person" name="contact" rules={[{ max: 200 }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="Phone"
          name="phone"
          rules={[
            { max: 50 },
            {
              pattern: /^[\d\s\-+()]*$/,
              message: "Enter a valid phone number",
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Default delivery charge"
          name="default_delivery_charge"
          extra="Filled in on an order when you choose this partner. You can change it per order."
        >
          <InputNumber
            min={0}
            precision={2}
            style={{ width: "100%" }}
            suffix="BDT"
          />
        </Form.Item>
        <Form.Item
          label="Default COD fee"
          name="default_cod_fee_percent"
          extra="Percentage of the cash the partner collects."
        >
          <InputNumber
            min={0}
            max={100}
            precision={2}
            style={{ width: "100%" }}
            suffix="%"
          />
        </Form.Item>
        <Form.Item label="Notes" name="notes" rules={[{ max: 1000 }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item
          label="Active"
          name="is_active"
          valuePropName="checked"
          extra="Inactive partners cannot be chosen for new orders."
        >
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={save.isPending} block>
          {editing ? "Save changes" : "Add partner"}
        </Button>
      </Form>
    </Drawer>
  );
}
