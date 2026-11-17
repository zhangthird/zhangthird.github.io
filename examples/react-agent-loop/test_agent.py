"""Python ReAct Agent 示例回归测试：python -m unittest discover -s examples/react-agent-loop -p 'test_*.py'"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import unittest


MODULE_PATH = Path(__file__).with_name("agent.py")
SPEC = importlib.util.spec_from_file_location("react_agent_example", MODULE_PATH)
agent = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(agent)


class ReActAgentTests(unittest.TestCase):
    def test_offline_demo_and_matching_call_ids(self):
        events = []
        result = agent.run_agent(
            agent.DemoClient(),
            "查询 project-alpha 的剩余预算。",
            on_event=events.append,
        )
        self.assertEqual(result["status"], "finished")
        self.assertEqual(result["turns"], 3)
        self.assertEqual(result["toolCalls"], 2)
        self.assertIn("1760", result["answer"])
        calls = [
            call["id"]
            for message in result["messages"]
            for call in message.get("tool_calls", [])
        ]
        outputs = [
            message["tool_call_id"]
            for message in result["messages"]
            if message["role"] == "tool"
        ]
        self.assertEqual(calls, outputs)
        self.assertEqual(
            [event["name"] for event in events if event["type"] == "tool"],
            ["get_project_budget", "calculate_remaining"],
        )

    def test_unknown_tool_is_rejected(self):
        result = agent.execute_tool({
            "type": "function",
            "function": {"name": "bash", "arguments": '{"command":"ls"}'},
        })
        self.assertFalse(result["ok"])
        self.assertIn("未授权", result["error"])

    def test_invalid_json_is_returned_as_observation(self):
        result = agent.execute_tool({
            "type": "function",
            "function": {"name": "get_project_budget", "arguments": "{"},
        })
        self.assertFalse(result["ok"])

    def test_invalid_number_types_and_extra_fields(self):
        for bad_args in [
            {"budget": "3000", "spent": 1240},
            {"budget": True, "spent": 1240},
            {"budget": float("inf"), "spent": 1240},
            {"budget": 3000, "spent": 1240, "command": "danger"},
        ]:
            with self.subTest(bad_args=bad_args):
                result = agent.execute_tool({
                    "type": "function",
                    "function": {
                        "name": "calculate_remaining",
                        "arguments": json.dumps(bad_args),
                    },
                })
                self.assertFalse(result["ok"])

    def test_multiple_tool_calls_in_single_turn(self):
        class MultiToolClient:
            def complete(self, *, messages, tools):
                if not any(message["role"] == "tool" for message in messages):
                    return {
                        "role": "assistant", "content": None,
                        "tool_calls": [
                            {
                                "id": "one", "type": "function",
                                "function": {
                                    "name": "get_project_budget",
                                    "arguments": '{"project":"project-alpha"}',
                                },
                            },
                            {
                                "id": "two", "type": "function",
                                "function": {
                                    "name": "calculate_remaining",
                                    "arguments": '{"budget":3000,"spent":1240}',
                                },
                            },
                        ],
                    }
                return {"role": "assistant", "content": "查询完成", "finish_reason": "stop"}

        result = agent.run_agent(MultiToolClient(), "查询预算")
        self.assertEqual(result["status"], "finished")
        self.assertEqual(result["toolCalls"], 2)
        messages = result["messages"]
        self.assertEqual([m["tool_call_id"] for m in messages if m["role"] == "tool"], ["one", "two"])

    def test_max_tool_calls_does_not_append_orphan_call(self):
        result = agent.run_agent(
            agent.DemoClient(), "查询余额", max_tool_calls=1,
        )
        self.assertEqual(result["status"], "max_tool_calls")
        self.assertEqual(result["toolCalls"], 1)
        self.assertEqual(
            len([m for m in result["messages"] if m["role"] == "tool"]), 1,
        )
        self.assertEqual(
            len([m for m in result["messages"] if m.get("tool_calls")]), 1,
        )

    def test_max_turns(self):
        result = agent.run_agent(
            agent.DemoClient(), "查询余额", max_turns=2,
        )
        self.assertEqual(result["status"], "max_turns")
        self.assertEqual(result["turns"], 2)

    def test_incomplete_response(self):
        class IncompleteClient:
            def complete(self, *, messages, tools):
                return {"role": "assistant", "content": "仅部分输出", "finish_reason": "length"}

        result = agent.run_agent(IncompleteClient(), "查询余额")
        self.assertEqual(result["status"], "incomplete")

    def test_model_error(self):
        class BrokenClient:
            def complete(self, *, messages, tools):
                raise TimeoutError("mock timeout")

        result = agent.run_agent(BrokenClient(), "查询余额")
        self.assertEqual(result["status"], "model_error")

    def test_reject_duplicate_call_ids(self):
        class DuplicateIdClient:
            def complete(self, *, messages, tools):
                call = {
                    "id": "duplicate", "type": "function",
                    "function": {
                        "name": "get_project_budget",
                        "arguments": '{"project":"project-alpha"}',
                    },
                }
                return {"role": "assistant", "content": None, "tool_calls": [call, call]}

        result = agent.run_agent(DuplicateIdClient(), "查询余额")
        self.assertEqual(result["status"], "model_error")
        self.assertFalse(any(message["role"] == "tool" for message in result["messages"]))

    def test_input_validation(self):
        with self.assertRaises(ValueError):
            agent.run_agent(agent.DemoClient(), "查询余额", max_turns=0)
        with self.assertRaises(TypeError):
            agent.run_agent(agent.DemoClient(), "   ")
        with self.assertRaises(ValueError):
            agent.ChatClient(api_key="", model="mock")


if __name__ == "__main__":
    unittest.main()
