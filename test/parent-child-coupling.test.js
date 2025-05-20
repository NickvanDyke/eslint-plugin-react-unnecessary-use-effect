import { MyRuleTester, js } from "./rule-tester.js";
import { messageIds } from "../src/messages.js";

new MyRuleTester().run("/parent-child-coupling", {
  // TODO: Test with intermediate state too
  invalid: [
    {
      name: "Pass internal live state",
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
      name: "Pass internal live state via derived prop",
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
      name: "No-arg prop callback in response to internal state change",
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
      name: "Pass live external state",
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
      name: "Pass final external state",
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
              // NOTE: Also verifies that we consider 'events' in 'events.onClose' to be a fn ref
              // (It's a MemberExpression under a CallExpression)
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
    {
      name: "Derive state from prop function",
      code: js`
        function FilteredPosts({ posts }) {
          const [filteredPosts, setFilteredPosts] = useState([]);

          useEffect(() => {
            // Resulting AST node looks like:
            // {
            //   "type": "ArrayPattern",
            //   "elements": [
            //     null, <-- Must handle this!
            //     {
            //       "type": "Identifier",
            //       "name": "second"
            //     }
            //   ]
            // }
            setFilteredPosts(
              posts.filter((post) => post.body !== "")
            );
          }, [posts]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
        },
        {
          messageId: messageIds.avoidParentChildCoupling,
        },
      ],
    },
  ],
});
