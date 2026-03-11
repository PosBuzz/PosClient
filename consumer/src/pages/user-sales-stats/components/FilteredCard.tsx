import { Card, DatePicker, Select, Space, Typography } from "antd";
import dayjs from "dayjs";
import React from "react";

const { RangePicker } = DatePicker;
const { Text } = Typography;
const { Option } = Select;

interface FilterCardProps {
  dateRange: [dayjs.Dayjs, dayjs.Dayjs];
  setDateRange: React.Dispatch<
    React.SetStateAction<[dayjs.Dayjs, dayjs.Dayjs]>
  >;
  // Add branch props
  branchId?: number | null;
  setBranchId: React.Dispatch<React.SetStateAction<number | null | undefined>>;
  branchOptions: { id: number; name: string }[]; // Options for the dropdown
}

const FilterCard: React.FC<FilterCardProps> = ({
  dateRange,
  setDateRange,
  branchId,
  setBranchId,
  branchOptions,
}) => {
  const disabledDate = (current: dayjs.Dayjs) =>
    current && current.isAfter(dayjs().endOf("day"));

  return (
    <Card>
      <Space size="large" wrap align="center">
        <Text strong>Filter by Date</Text>
        <RangePicker
          value={dateRange}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setDateRange([dates[0], dates[1]]);
            }
          }}
          format="YYYY-MM-DD"
          disabledDate={disabledDate}
          allowClear={false}
        />
        {/* Added Branch Filter */}
        <Text strong style={{ marginLeft: 16 }}>Branch:</Text>
        <Select
          style={{ minWidth: 200 }}
          placeholder="All Branches"
          value={branchId}
          onChange={(value) => setBranchId(value)}
          allowClear
        >
          {branchOptions?.map((branch) => (
            <Option key={branch.id} value={branch.id}>
              {branch.name}
            </Option>
          ))}
        </Select>
      </Space>
    </Card>
  );
};

export default FilterCard;
