import { router } from 'expo-router';

import { TransactionComposer } from '../../../src/components/transaction-composer';
import { TransactionForm } from '../../../src/components/transaction-form';
import { useToast } from '../../../src/data/toast';
import { useCreateTransaction } from '../../../src/data/transactions';

export default function NewTransactionScreen() {
  const create = useCreateTransaction();
  const showToast = useToast((state) => state.show);

  return (
    <TransactionComposer>
      <TransactionForm
        title="New transaction"
        submitting={create.isPending}
        onSubmit={async (input) => {
          await create.mutateAsync(input);
          showToast('Transaction saved');
          router.back();
        }}
      />
    </TransactionComposer>
  );
}
