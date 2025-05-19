import { MyRuleTester, js } from "./rule-tester.js";
import { messageIds } from "../src/messages.js";

new MyRuleTester().run("/chaining-state", {
  invalid: [
    {
      // React docs recommend to first update state in render instead of an effect.
      // But then continue on to say that usually you can avoid the sync entirely by
      // more wisely choosing your state. So we'll just always warn about chained state.
      name: "Syncing prop changes to internal state",
      code: js`
        function List({ items }) {
          const [selection, setSelection] = useState();

          useEffect(() => {
            setSelection(null);
          }, [items]);

          return (
            <div>
              {items.map((item) => (
                <div key={item.id} onClick={() => setSelection(item)}>
                  {item.name}
                </div>
              ))}
            </div>
          )
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidChainingState,
        },
      ],
    },
    {
      name: "Conditionally setting state from internal state",
      code: js`
        function Form() {
          const [error, setError] = useState();
          const [result, setResult] = useState();

          useEffect(() => {
            if (result.data) {
              setError(null);
            }
          }, [result]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidChainingState,
        },
      ],
    },
    {
      name: "Using prop in state initializer",
      code: js`
        function List({ items }) {
          // Verify that 'setSelection' is not considered a prop ref
          // just because 'items' is on its definition path.
          // If it did, it'd flag 'avoidParentChildCoupling'.
          const [selection, setSelection] = useState(items[0]);

          useEffect(() => {
            setSelection(null);
          }, [items]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidChainingState,
        },
      ],
    },
  ],
});
