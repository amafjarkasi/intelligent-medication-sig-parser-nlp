use pest::Parser;
use pest_derive::Parser;

#[derive(Parser)]
#[grammar = "sig_grammar.pest"]
struct SigParser;

fn main() {
    let input = "take 1 tab po once_daily";
    let parsed = SigParser::parse(Rule::sig_instruction, input);
    match parsed {
        Ok(_) => println!("Success!"),
        Err(e) => println!("Error: {:#?}", e),
    }
}
