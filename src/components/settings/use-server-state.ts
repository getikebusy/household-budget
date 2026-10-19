import { useState } from 'react';

export function useServerState<T>(server: T) {
  const [previous, setPrevious] = useState(server);
  const [value, setValue] = useState(server);

  if (!Object.is(server, previous)) {
    setPrevious(server);
    setValue(server);
  }

  return [value, setValue] as const;
}
