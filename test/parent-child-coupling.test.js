import { MyRuleTester, js } from "./rule-tester.js";
import { messageIds } from "../src/messages.js";

new MyRuleTester().run("/parent-child-coupling", {
  // TODO: Test with intermediate state too
  invalid: [
    {
      name: "Internal state",
      code: js`
        const Child = ({ onFetched }) => {
          const [data, setData] = useState();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidParentChildCoupling,
        },
      ],
    },
    {
      name: "Internal state via derived prop",
      code: js`
        const Child = ({ onFetched }) => {
          const [data, setData] = useState();
          // No idea why someone would do this, but hey we can catch it
          const onFetchedWrapper = onFetched

          useEffect(() => {
            onFetchedWrapper(data);
          }, [onFetched, data]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidParentChildCoupling,
        },
      ],
    },
    {
      name: "No argument prop callback in response to internal state change",
      code: js`
        function Form({ onClose }) {
          const [name, setName] = useState();
          const [isOpen, setIsOpen] = useState(true);

          useEffect(() => {
            onClose();
          }, [isOpen]);

          return (
            <button onClick={() => setIsOpen(false)}>Submit</button>
          )
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidParentChildCoupling,
        },
      ],
    },
    {
      name: "External state live",
      code: js`
        const Child = ({ onFetched }) => {
          const data = useSomeAPI();

          useEffect(() => {
            onFetched(data);
          }, [onFetched, data]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidParentChildCoupling,
        },
      ],
    },
    {
      name: "External state final",
      code: js`
        function Form({ onSubmit }) {
          const [name, setName] = useState();
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            onSubmit(dataToSubmit);
          }, [dataToSubmit]);

          return (
            <div>
              <input
                name="name"
                type="text"
                onChange={(e) => setName(e.target.value)}
              />
              <button onClick={() => setDataToSubmit({ name })}>Submit</button>
            </div>
          )
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          // TODO: Ideally we catch using state as an event handler,
          // but not sure how to differentiate that
          messageId: messageIds.avoidParentChildCoupling,
        },
      ],
    },
    {
      name: "Call prop in response to prop change",
      code: js`
        function Form({ isOpen, events }) {

          useEffect(() => {
            if (!isOpen) {
              // NOTE: Also verifies that we consider events in events.onClose to be a fn ref
              // (It's a MemberExpression under a CallExpression)
              // FIX: Oh interesting, scope.references only includes events, not onClose.
              // Thus we don't analyze it because the Identifier's direct parent is MemberExpression, not CallExpression.
              // Solution may be to map the MemberExpression to its parent CallExpression?
              events.onClose();
            }
          }, [isOpen]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidParentChildCoupling,
        },
      ],
    },
  ],
});
