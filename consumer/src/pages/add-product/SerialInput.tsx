import { Input, Button } from "antd";
import { useState } from "react";

export default function SerialInput() {
  const [serials, setSerials] = useState<string[]>([""]);

  const handleChange = (index: number, value: string) => {
    const newSerials = [...serials];
    newSerials[index] = value;
    setSerials(newSerials);
  };

  const addSerial = () => setSerials([...serials, ""]);

  return (
    <div className="space-y-2">
      {serials.map((serial, i) => (
        <Input
          key={i}
          placeholder={`Serial ${i + 1}`}
          value={serial}
          onChange={(e) => handleChange(i, e.target.value)}
        />
      ))}
      <Button onClick={addSerial}>Add Serial</Button>
    </div>
  );
}
