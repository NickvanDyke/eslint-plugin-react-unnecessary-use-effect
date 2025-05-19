import { MyRuleTester, js } from "./rule-tester.js";
import { messageIds } from "../src/messages.js";

// TODO: All these need the state setter in the deps
new MyRuleTester().run("/deriving-state", {
  valid: [
    {
      name: "Compute in render from internal state",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');

          const fullName = firstName + ' ' + lastName;
        }
      `,
    },
    {
      name: "Compute in render from props",
      code: js`
        function Form({ firstName, lastName }) {
          const fullName = firstName + ' ' + lastName;
        }
      `,
    },
    {
      name: "From external state change",
      code: js`
        function Feed() {
          const { data: posts } = useQuery('/posts');
          const [scrollPosition, setScrollPosition] = useState(0);

          useEffect(() => {
            setScrollPosition(0);
          }, [posts]);
        }
      `,
    },
    {
      name: "From external state change, with multiple setter calls",
      code: js`
        function Feed() {
          const { data: posts } = useQuery('/posts');
          const [selectedPost, setSelectedPost] = useState();

          useEffect(() => {
            setSelectedPost(posts[0]);
          }, [posts]);

          return (
            <div>
              {posts.map((post) => (
                <div key={post.id} onClick={() => setSelectedPost(post)}>
                  {post.title}
                </div>
              ))}
            </div>
          )
        }
      `,
    },
    {
      name: "Fetch external state on mount",
      code: js`
        function Todos() {
          const [todos, setTodos] = useState([]);

          useEffect(() => {
            fetchTodos().then((todos) => {
              setTodos(todos);
            });
          }, []);
        }
      `,
    },
    {
      name: "Sync external state",
      // Technically we could trigger the network call in `input.onChange`,
      // but the use of an effect to sync state is arguably more readable and a valid use.
      // Especially when we already store the input's controlled state.
      code: js`
        function Search() {
          const [query, setQuery] = useState();
          const [results, setResults] = useState();

          useEffect(() => {
            fetchResults(query).then((data) => {
              setResults(data);
            });
          }, [query]);

          return (
            <div>
              <input
                name="query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ul>
                {results.map((result) => (
                  <li key={result.id}>{result.title}</li>
                ))}
              </ul>
            </div>
          )
        }
      `,
    },
    {
      name: "Subscribe to external state",
      code: js`
        function Status() {
          const [status, setStatus] = useState();

          useEffect(() => {
            const unsubscribe = subscribeToStatus(topic, (status) => {
              setStatus(status);
            });

            return () => unsubscribe();
          }, [topic]);

          return <div>{status}</div>;
        }
      `,
    },
    {
      name: "With external function call",
      code: js`
        function TodoList({ todos, filter }) {
          const [newTodo, setNewTodo] = useState("");
          const [visibleTodos, setVisibleTodos] = useState([]);

          useEffect(() => {
            // We can't be sure getFilteredTodos is pure, so we can't warn about this
            setVisibleTodos(getFilteredTodos(todos, filter));
          }, [todos, filter]);
        }
      `,
    },
    {
      name: "From derived external state with multiple calls to setter",
      code: js`
        function Form() {
          const name = useQuery('/name');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            const prefixedName = 'Dr. ' + name;
            setFullName(prefixedName) 
          }, [name]);

          return (
            <input
              name="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )
        }
      `,
    },
    {
      name: "From external state via member function",
      code: js`
        function Counter() {
          const countGetter = useSomeAPI();
          const [count, setCount] = useState(0);

          useEffect(() => {
            const newCount = countGetter.getCount();
            setCount(newCount);
          }, [countGetter, setCount]);
        }
      `,
    },
  ],
  invalid: [
    {
      name: "From internal state",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');

          const [fullName, setFullName] = useState('');
          useEffect(() => setFullName(firstName + ' ' + lastName), [firstName, lastName]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "fullName" },
        },
      ],
    },
    {
      name: "From derived internal state",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            const name = firstName + ' ' + lastName;
            setFullName(name) 
          }, [firstName, lastName]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "fullName" },
        },
      ],
    },
    {
      name: "From derived internal state outside effect",
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');
          const [fullName, setFullName] = useState('');
          const name = firstName + ' ' + lastName;

          useEffect(() => {
            setFullName(name) 
          }, [name]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "fullName" },
        },
      ],
    },
    {
      name: "From props",
      code: js`
        function Form({ firstName, lastName }) {
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            setFullName(firstName + ' ' + lastName);
          }, [firstName, lastName]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "fullName" },
        },
      ],
    },
    {
      name: "From derived prop",
      code: js`
        function Form({ firstName, lastName }) {
          const [fullName, setFullName] = useState('');
          const prefixedName = 'Dr. ' + firstName;

          useEffect(() => {
            setFullName(prefixedName + ' ' + lastName);
          }, [prefixedName, lastName]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "fullName" },
        },
      ],
    },
    {
      name: "From props via member function",
      code: js`
        function DoubleList({ list }) {
          const [doubleList, setDoubleList] = useState([]);

          useEffect(() => {
            setDoubleList(list.concat(list));
          }, [list]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "doubleList" },
        },
        {
          // NOTE: We consider `list.concat` to essentially be a prop callback
          messageId: messageIds.avoidParentChildCoupling,
        },
      ],
    },
    {
      name: "From internal state via member function",
      code: js`
        function DoubleList() {
          const [list, setList] = useState([]);
          const [doubleList, setDoubleList] = useState([]);

          useEffect(() => {
            setDoubleList(list.concat(list));
          }, [list]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "doubleList" },
        },
        {
          // NOTE: We consider `list.concat` to essentially be a state setter call
          messageId: messageIds.avoidDerivedState,
          data: { state: "list" },
        },
      ],
    },
    {
      name: "Mutate internal state",
      code: js`
        function DoubleList() {
          const [list, setList] = useState([]);
          const [doubleList, setDoubleList] = useState([]);

          useEffect(() => {
            doubleList.push(...list);
          }, [list]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          // NOTE: We consider `doubleList.push` to essentially be a state setter call
          messageId: messageIds.avoidDerivedState,
          data: { state: "doubleList" },
        },
      ],
    },
    {
      name: "From external state with single setter call",
      todo: true,
      code: js`
        function Feed() {
          const { data: posts } = useQuery('/posts');
          const [selectedPost, setSelectedPost] = useState();

          useEffect(() => {
            // This is the only place that modifies the state,
            // thus they will always be in sync and it could be computed during render
            // Difficult bit is that a single state setter call is legit when the 
            // external state is initialized inside the effect (i.e. retrieved from external system)
            setSelectedPost(posts[0]);
          }, [posts]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "selectedPost" },
        },
      ],
    },
    {
      name: "From derived external state with single setter call",
      todo: true,
      code: js`
        function Form() {
          const name = useQuery('/name');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            const prefixedName = 'Dr. ' + name;
            setFullName(prefixedName) 
          }, [name]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "fullName" },
        },
      ],
    },
    {
      name: "From internal state with callback setter",
      todo: true,
      code: js`
        function CountAccumulator({ count }) {
          const [total, setTotal] = useState(count);

          useEffect(() => {
            setTotal((prev) => prev + count);
          }, [count]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "total" },
        },
      ],
    },
    {
      name: "Partially update complex state from props",
      code: js`
        function Form({ firstName, lastName }) {
          const [formData, setFormData] = useState({
            title: 'Dr.',
            fullName: '',
          });

          useEffect(() => {
            setFormData({
              ...formData,
              fullName: firstName + ' ' + lastName,
            });
          }, [firstName, lastName, formData]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "formData" },
        },
      ],
    },
    {
      name: "Partially update complex state from props with callback setter",
      todo: true,
      code: js`
        function Form({ firstName, lastName }) {
          const [formData, setFormData] = useState({
            title: 'Dr.',
            fullName: '',
          });

          useEffect(() => {
            setFormData((prev) => ({
              ...prev,
              fullName: firstName + ' ' + lastName,
            }));
          }, [firstName, lastName]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "formData" },
        },
      ],
    },
    {
      name: "Partially update complex state from props with derived setter",
      code: js`
        function Form({ firstName, lastName }) {
          const [formData, setFormData] = useState({
            title: 'Dr.',
            fullName: '',
          });

          const setFullName = (fullName) => setFormData({ ...formData, fullName });

          useEffect(() => {
            setFormData({
              ...formData,
              fullName: firstName + ' ' + lastName,
            });
          }, [firstName, lastName, formData]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidInternalEffect,
        },
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "formData" },
        },
      ],
    },
    {
      name: "Derived state in larger, otherwise legit effect",
      todo: true,
      code: js`
        function Form() {
          const [firstName, setFirstName] = useState('Taylor');
          const [lastName, setLastName] = useState('Swift');
          const [fullName, setFullName] = useState('');

          useEffect(() => {
            console.log(name);

            setFullName(firstName + ' ' + lastName;);
          }, [firstName, lastName]);
        }
      `,
      errors: [
        {
          messageId: messageIds.avoidDerivedState,
          data: { state: "fullName" },
        },
      ],
    },
  ],
});
