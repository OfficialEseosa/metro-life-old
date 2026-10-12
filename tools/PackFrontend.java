import java.nio.file.*;
import java.util.zip.*;
public class PackFrontend {
 public static void main(String[] args)throws Exception{
  Path root=Path.of("").toAbsolutePath(),dist=root.resolve("frontend/dist"),zip=root.resolve("tools/frontend.zip");
  if(!Files.isRegularFile(dist.resolve("index.html")))throw new IllegalStateException("Build the frontend first");
  try(var output=new ZipOutputStream(Files.newOutputStream(zip));var paths=Files.walk(dist)){
   for(Path path:paths.filter(Files::isRegularFile).sorted().toList()){
    String entry=dist.relativize(path).toString().replace('\\','/');if(entry.startsWith("models/"))continue;
    ZipEntry e=new ZipEntry(entry);e.setTime(0);output.putNextEntry(e);Files.copy(path,output);output.closeEntry();
   }
  }
  System.out.println("Bundled frontend: "+Files.size(zip)+" bytes");
 }
}
