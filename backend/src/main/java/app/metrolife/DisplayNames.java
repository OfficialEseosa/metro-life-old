package app.metrolife;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.util.*;
final class DisplayNames {
 static JsonNode data;static List<Map.Entry<String,String>> pairs;
 static synchronized void load(ObjectMapper mapper){if(data!=null)return;try(var in=DisplayNames.class.getResourceAsStream("/static-data/display-names.json")){data=mapper.readTree(in);pairs=new ArrayList<>();data.path("replace").fields().forEachRemaining(e->pairs.add(Map.entry(e.getKey(),e.getValue().asText())));pairs.sort((a,b)->Integer.compare(b.getKey().length(),a.getKey().length()));}catch(Exception e){throw new IllegalStateException("Venue names missing",e);}}
 static String text(String value){if(pairs!=null)for(var pair:pairs)value=value.replace(pair.getKey(),pair.getValue());return value;}
 static void apply(JsonNode node){if(node instanceof ObjectNode object){var keys=new ArrayList<String>();object.fieldNames().forEachRemaining(keys::add);for(String key:keys){JsonNode value=object.get(key);if(value.isTextual()&&!Set.of("id","userId","username","owner","link","url").contains(key))object.put(key,text(value.asText()));else apply(value);}}else if(node instanceof ArrayNode array){for(int i=0;i<array.size();i++){JsonNode value=array.get(i);if(value.isTextual())array.set(i,TextNode.valueOf(text(value.asText())));else apply(value);}}}
}
