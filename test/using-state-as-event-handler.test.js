import { MyRuleTester, js } from "./rule-tester.js";
import { messageIds } from "../src/messages.js";

new MyRuleTester().run("/using-state-as-event-handler", {
  invalid: [
    {
      //  TODO: How to detect this though? Not sure it's discernable from legit synchronization effects.
      //  Maybe when the setter is only called in this one place? Meaning we could instead inline the effect.
      name: "Using state to handle an event",
      todo: true,
      code: js`
        function Form() {
          const [name, setName] = useState();
          const [dataToSubmit, setDataToSubmit] = useState();

          useEffect(() => {
            submitData(dataToSubmit);
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
          messageId: messageIds.avoidEventHandler,
        },
      ],
    },
  ],
});
